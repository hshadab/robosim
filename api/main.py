"""
RoboSim API - Parquet Conversion & HuggingFace Upload

Handles:
1. Converting LeRobot episode JSON to Parquet format
2. Uploading datasets to HuggingFace Hub
3. Stripe webhook for Pro subscriptions
"""

import io
import json
import tempfile
import os
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyarrow as pa
import pyarrow.parquet as pq
from huggingface_hub import HfApi, create_repo
import stripe
from supabase import create_client, Client

# Stripe configuration
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")  # Service role key for admin access

def get_supabase() -> Optional[Client]:
    """Get Supabase client if configured"""
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return None

app = FastAPI(
    title="RoboSim API",
    description="Backend for Parquet conversion and HuggingFace upload",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EpisodeFrame(BaseModel):
    timestamp: float
    observation: dict
    action: dict


class Episode(BaseModel):
    episodeIndex: int
    frames: list[dict]
    metadata: dict


class DatasetMetadata(BaseModel):
    robotType: str
    totalFrames: int
    totalEpisodes: int
    fps: int = 30
    features: dict = {}


class UploadRequest(BaseModel):
    episodes: list[Episode]
    metadata: DatasetMetadata
    hfToken: str
    repoName: str
    isPrivate: bool = True
    description: Optional[str] = None


class UploadResponse(BaseModel):
    success: bool
    repoUrl: str
    message: str


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "robosim-api"}


@app.post("/api/dataset/upload", response_model=UploadResponse)
async def upload_dataset(request: UploadRequest):
    """
    Convert episodes to Parquet and upload to HuggingFace Hub.

    LeRobot v3.0 format:
    - data/train-XXXXX-of-XXXXX.parquet (episode data)
    - meta/info.json (dataset metadata)
    - meta/episodes.jsonl (episode metadata)
    - meta/tasks.jsonl (task descriptions)
    """
    try:
        hf_api = HfApi(token=request.hfToken)

        # Validate token
        try:
            user_info = hf_api.whoami()
            username = user_info["name"]
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Invalid HuggingFace token: {e}")

        # Full repo ID
        repo_id = f"{username}/{request.repoName}"

        # Create or get repo
        try:
            create_repo(
                repo_id=repo_id,
                token=request.hfToken,
                repo_type="dataset",
                private=request.isPrivate,
                exist_ok=True,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create repo: {e}")

        # Convert episodes to columnar format and create Parquet
        with tempfile.TemporaryDirectory() as tmpdir:
            tmppath = Path(tmpdir)

            # Create directory structure
            (tmppath / "data").mkdir()
            (tmppath / "meta").mkdir()

            # Convert all episodes to a single Parquet file
            all_rows = []
            episode_metadata = []
            tasks = set()

            for episode in request.episodes:
                ep_idx = episode.episodeIndex
                task = episode.metadata.get("languageInstruction", "manipulation task")
                tasks.add(task)

                episode_metadata.append({
                    "episode_index": ep_idx,
                    "tasks": [task],
                    "length": len(episode.frames),
                })

                for frame_idx, frame in enumerate(episode.frames):
                    obs = frame.get("observation", {})
                    action = frame.get("action", {})

                    row = {
                        "episode_index": ep_idx,
                        "frame_index": frame_idx,
                        "timestamp": frame.get("timestamp", frame_idx / 30.0),
                        "task_index": 0,  # Single task for now
                    }

                    # Add observation fields
                    if "jointPositions" in obs:
                        row["observation.state"] = obs["jointPositions"]
                    if "image" in obs:
                        # Store image as bytes if present
                        row["observation.image"] = obs["image"]

                    # Add action fields
                    if "jointPositions" in action:
                        row["action"] = action["jointPositions"]
                    elif "targetPositions" in action:
                        row["action"] = action["targetPositions"]

                    all_rows.append(row)

            # Create Parquet file
            if all_rows:
                # Build schema dynamically based on data
                schema_fields = [
                    ("episode_index", pa.int64()),
                    ("frame_index", pa.int64()),
                    ("timestamp", pa.float64()),
                    ("task_index", pa.int64()),
                ]

                # Check for state/action dimensions from first row
                sample_row = all_rows[0]
                if "observation.state" in sample_row:
                    state_dim = len(sample_row["observation.state"])
                    schema_fields.append(("observation.state", pa.list_(pa.float32(), state_dim)))
                if "action" in sample_row:
                    action_dim = len(sample_row["action"])
                    schema_fields.append(("action", pa.list_(pa.float32(), action_dim)))

                # Convert to columnar format
                columns = {field[0]: [] for field in schema_fields}
                for row in all_rows:
                    for field_name, _ in schema_fields:
                        if field_name in row:
                            val = row[field_name]
                            # Convert lists to proper format
                            if isinstance(val, list):
                                columns[field_name].append([float(v) for v in val])
                            else:
                                columns[field_name].append(val)
                        else:
                            columns[field_name].append(None)

                # Create PyArrow table
                arrays = []
                names = []
                for field_name, field_type in schema_fields:
                    if field_name in columns and columns[field_name]:
                        if "list_" in str(field_type):
                            # Handle list types
                            arr = pa.array(columns[field_name], type=field_type)
                        else:
                            arr = pa.array(columns[field_name], type=field_type)
                        arrays.append(arr)
                        names.append(field_name)

                table = pa.table(dict(zip(names, arrays)))

                # Write Parquet file
                parquet_path = tmppath / "data" / "train-00000-of-00001.parquet"
                pq.write_table(table, parquet_path)

            # Create meta/info.json
            info = {
                "codebase_version": "v3.0",
                "robot_type": request.metadata.robotType,
                "fps": request.metadata.fps,
                "total_episodes": len(request.episodes),
                "total_frames": sum(len(ep.frames) for ep in request.episodes),
                "features": {
                    "observation.state": {
                        "dtype": "float32",
                        "shape": [len(all_rows[0].get("observation.state", []))] if all_rows else [6],
                        "names": ["joint_1", "joint_2", "joint_3", "joint_4", "joint_5", "gripper"],
                    },
                    "action": {
                        "dtype": "float32",
                        "shape": [len(all_rows[0].get("action", []))] if all_rows else [6],
                        "names": ["joint_1", "joint_2", "joint_3", "joint_4", "joint_5", "gripper"],
                    },
                },
                "splits": {"train": f"0:{len(request.episodes)}"},
            }

            with open(tmppath / "meta" / "info.json", "w") as f:
                json.dump(info, f, indent=2)

            # Create meta/episodes.jsonl
            with open(tmppath / "meta" / "episodes.jsonl", "w") as f:
                for ep_meta in episode_metadata:
                    f.write(json.dumps(ep_meta) + "\n")

            # Create meta/tasks.jsonl
            with open(tmppath / "meta" / "tasks.jsonl", "w") as f:
                for i, task in enumerate(tasks):
                    f.write(json.dumps({"task_index": i, "task": task}) + "\n")

            # Create README.md
            readme_content = f"""---
license: apache-2.0
task_categories:
  - robotics
tags:
  - LeRobot
  - robotics
  - manipulation
---

# {request.repoName}

Robot manipulation dataset created with [RoboSim](https://github.com/hshadab/robotics-simulation).

## Dataset Information

- **Robot Type**: {request.metadata.robotType}
- **Total Episodes**: {len(request.episodes)}
- **Total Frames**: {sum(len(ep.frames) for ep in request.episodes)}
- **FPS**: {request.metadata.fps}

## Usage

```python
from lerobot.common.datasets.lerobot_dataset import LeRobotDataset

dataset = LeRobotDataset("{repo_id}")
```

## Training

```bash
python -m lerobot.scripts.train \\
    --dataset.repo_id={repo_id} \\
    --policy.type=act
```
"""
            with open(tmppath / "README.md", "w") as f:
                f.write(readme_content)

            # Upload all files to HuggingFace
            hf_api.upload_folder(
                folder_path=tmpdir,
                repo_id=repo_id,
                repo_type="dataset",
                commit_message="Upload dataset from RoboSim",
            )

        repo_url = f"https://huggingface.co/datasets/{repo_id}"

        return UploadResponse(
            success=True,
            repoUrl=repo_url,
            message=f"Successfully uploaded {len(request.episodes)} episodes to {repo_id}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/dataset/convert")
async def convert_to_parquet(episodes: list[Episode]):
    """
    Convert episodes to Parquet format and return as bytes.
    For local download without HuggingFace upload.
    """
    try:
        all_rows = []

        for episode in episodes:
            ep_idx = episode.episodeIndex

            for frame_idx, frame in enumerate(episode.frames):
                obs = frame.get("observation", {})
                action = frame.get("action", {})

                row = {
                    "episode_index": ep_idx,
                    "frame_index": frame_idx,
                    "timestamp": frame.get("timestamp", frame_idx / 30.0),
                }

                if "jointPositions" in obs:
                    row["observation.state"] = obs["jointPositions"]
                if "jointPositions" in action:
                    row["action"] = action["jointPositions"]

                all_rows.append(row)

        if not all_rows:
            raise HTTPException(status_code=400, detail="No frames to convert")

        # Create simple columnar format
        columns = {
            "episode_index": [r["episode_index"] for r in all_rows],
            "frame_index": [r["frame_index"] for r in all_rows],
            "timestamp": [r["timestamp"] for r in all_rows],
        }

        if "observation.state" in all_rows[0]:
            columns["observation.state"] = [r.get("observation.state", []) for r in all_rows]
        if "action" in all_rows[0]:
            columns["action"] = [r.get("action", []) for r in all_rows]

        table = pa.table(columns)

        # Write to buffer
        buffer = io.BytesIO()
        pq.write_table(table, buffer)
        buffer.seek(0)

        return {
            "success": True,
            "parquet_base64": buffer.getvalue().hex(),
            "num_rows": len(all_rows),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None, alias="Stripe-Signature")):
    """
    Handle Stripe webhook events for subscription management.

    Events handled:
    - checkout.session.completed: Upgrade user to Pro tier
    - customer.subscription.deleted: Downgrade user to Free tier
    """
    payload = await request.body()

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Stripe webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {e}")

    # Handle the event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")

        if customer_email:
            # Update user tier in Supabase
            supabase = get_supabase()
            if supabase:
                try:
                    # Find user by email and update their tier
                    result = supabase.table("user_profiles").update({
                        "tier": "pro",
                        "tier_expires_at": None,  # Subscription doesn't expire (handled by Stripe)
                    }).eq("email", customer_email).execute()

                    print(f"[Stripe] Upgraded {customer_email} to Pro tier")
                except Exception as e:
                    print(f"[Stripe] Failed to update user tier: {e}")
            else:
                print(f"[Stripe] Supabase not configured, cannot update tier for {customer_email}")

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        if customer_id:
            # Get customer email from Stripe
            try:
                customer = stripe.Customer.retrieve(customer_id)
                customer_email = customer.get("email")

                if customer_email:
                    supabase = get_supabase()
                    if supabase:
                        try:
                            result = supabase.table("user_profiles").update({
                                "tier": "free",
                            }).eq("email", customer_email).execute()

                            print(f"[Stripe] Downgraded {customer_email} to Free tier")
                        except Exception as e:
                            print(f"[Stripe] Failed to downgrade user tier: {e}")
            except Exception as e:
                print(f"[Stripe] Failed to get customer: {e}")

    return {"received": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
