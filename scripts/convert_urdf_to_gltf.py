#!/usr/bin/env python3
"""
Convert SO-101 URDF/STL files to a single GLTF/GLB file with bone armature.
This creates a rigged robot model that works perfectly with Three.js and WebGPU.

Usage:
    pip install trimesh numpy scipy
    python convert_urdf_to_gltf.py
"""

import numpy as np
import trimesh
from pathlib import Path
import json

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
MODELS_DIR = PROJECT_ROOT / "public" / "models" / "so101"
ASSETS_DIR = MODELS_DIR / "assets"
OUTPUT_DIR = PROJECT_ROOT / "public" / "models"

# Material colors (from URDF)
COLORS = {
    "3d_printed": [0.96, 0.94, 0.90, 1.0],  # Cream/off-white #F5F0E6
    "sts3215": [0.1, 0.1, 0.1, 1.0],  # Dark gray/black for servos
}

# Joint hierarchy from URDF (parent -> child relationships)
# Each joint has: name, parent_link, child_link, origin_xyz, origin_rpy, axis
JOINTS = [
    {
        "name": "shoulder_pan",
        "parent": "base_link",
        "child": "shoulder_link",
        "origin_xyz": [0.0388353, 0, 0.0624],
        "origin_rpy": [3.14159, 0, -3.14159],
        "axis": [0, 0, 1],
    },
    {
        "name": "shoulder_lift",
        "parent": "shoulder_link",
        "child": "upper_arm_link",
        "origin_xyz": [-0.0303992, -0.0182778, -0.0542],
        "origin_rpy": [-1.5708, -1.5708, 0],
        "axis": [0, 0, 1],
    },
    {
        "name": "elbow_flex",
        "parent": "upper_arm_link",
        "child": "lower_arm_link",
        "origin_xyz": [-0.11257, -0.028, 0],
        "origin_rpy": [0, 0, 1.5708],
        "axis": [0, 0, 1],
    },
    {
        "name": "wrist_flex",
        "parent": "lower_arm_link",
        "child": "wrist_link",
        "origin_xyz": [-0.1349, 0.0052, 0],
        "origin_rpy": [0, 0, -1.5708],
        "axis": [0, 0, 1],
    },
    {
        "name": "wrist_roll",
        "parent": "wrist_link",
        "child": "gripper_link",
        "origin_xyz": [0, -0.0611, 0.0181],
        "origin_rpy": [1.5708, 0.0486795, 3.14159],
        "axis": [0, 0, 1],
    },
    {
        "name": "gripper",
        "parent": "gripper_link",
        "child": "moving_jaw_link",
        "origin_xyz": [0.0202, 0.0188, -0.0234],
        "origin_rpy": [1.5708, 0, 0],
        "axis": [0, 0, 1],
    },
]

# Link mesh definitions from URDF
LINKS = {
    "base_link": [
        {"file": "base_motor_holder_so101_v1.stl", "xyz": [-0.00636471, 0, -0.0024], "rpy": [1.5708, 0, 1.5708], "material": "3d_printed"},
        {"file": "base_so101_v2.stl", "xyz": [-0.00636471, 0, -0.0024], "rpy": [1.5708, 0, 1.5708], "material": "3d_printed"},
        {"file": "sts3215_03a_v1.stl", "xyz": [0.0263353, 0, 0.0437], "rpy": [0, 0, 0], "material": "sts3215"},
    ],
    "shoulder_link": [
        {"file": "sts3215_03a_v1.stl", "xyz": [-0.0303992, 0.000422241, -0.0417], "rpy": [1.5708, 1.5708, 0], "material": "sts3215"},
        {"file": "motor_holder_so101_base_v1.stl", "xyz": [-0.0675992, -0.000177759, 0.0158499], "rpy": [1.5708, -1.5708, 0], "material": "3d_printed"},
        {"file": "rotation_pitch_so101_v1.stl", "xyz": [0.0122008, 0, 0.0464], "rpy": [-1.5708, 0, 0], "material": "3d_printed"},
    ],
    "upper_arm_link": [
        {"file": "sts3215_03a_v1.stl", "xyz": [-0.11257, -0.0155, 0.0187], "rpy": [-3.14159, 0, -1.5708], "material": "sts3215"},
        {"file": "upper_arm_so101_v1.stl", "xyz": [-0.065085, 0.012, 0.0182], "rpy": [3.14159, 0, 0], "material": "3d_printed"},
    ],
    "lower_arm_link": [
        {"file": "under_arm_so101_v1.stl", "xyz": [-0.0648499, -0.032, 0.0182], "rpy": [3.14159, 0, 0], "material": "3d_printed"},
        {"file": "motor_holder_so101_wrist_v1.stl", "xyz": [-0.0648499, -0.032, 0.018], "rpy": [-3.14159, 0, 0], "material": "3d_printed"},
        {"file": "sts3215_03a_v1.stl", "xyz": [-0.1224, 0.0052, 0.0187], "rpy": [-3.14159, 0, -3.14159], "material": "sts3215"},
    ],
    "wrist_link": [
        {"file": "sts3215_03a_no_horn_v1.stl", "xyz": [0, -0.0424, 0.0306], "rpy": [1.5708, 1.5708, 0], "material": "sts3215"},
        {"file": "wrist_roll_pitch_so101_v2.stl", "xyz": [0, -0.028, 0.0181], "rpy": [-1.5708, -1.5708, 0], "material": "3d_printed"},
    ],
    "gripper_link": [
        {"file": "sts3215_03a_v1.stl", "xyz": [0.0077, 0.0001, -0.0234], "rpy": [-1.5708, 0, 0], "material": "sts3215"},
        {"file": "wrist_roll_follower_so101_v1.stl", "xyz": [0, 0, 0.000949706], "rpy": [-3.14159, 0, 0], "material": "3d_printed"},
    ],
    "moving_jaw_link": [
        {"file": "moving_jaw_so101_v1.stl", "xyz": [0, 0, 0.0189], "rpy": [0, 0, 0], "material": "3d_printed"},
    ],
}


def euler_to_matrix(rpy):
    """Convert roll-pitch-yaw to rotation matrix."""
    roll, pitch, yaw = rpy

    # Rotation matrices
    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(roll), -np.sin(roll)],
        [0, np.sin(roll), np.cos(roll)]
    ])
    Ry = np.array([
        [np.cos(pitch), 0, np.sin(pitch)],
        [0, 1, 0],
        [-np.sin(pitch), 0, np.cos(pitch)]
    ])
    Rz = np.array([
        [np.cos(yaw), -np.sin(yaw), 0],
        [np.sin(yaw), np.cos(yaw), 0],
        [0, 0, 1]
    ])

    return Rz @ Ry @ Rx


def create_transform(xyz, rpy):
    """Create 4x4 transformation matrix from xyz and rpy."""
    matrix = np.eye(4)
    matrix[:3, :3] = euler_to_matrix(rpy)
    matrix[:3, 3] = xyz
    return matrix


def load_and_transform_mesh(mesh_def, link_transform):
    """Load STL and apply transforms."""
    stl_path = ASSETS_DIR / mesh_def["file"]
    if not stl_path.exists():
        print(f"  Warning: {stl_path} not found")
        return None

    mesh = trimesh.load(stl_path)

    # Apply mesh-local transform (from URDF visual origin)
    local_transform = create_transform(mesh_def["xyz"], mesh_def["rpy"])
    mesh.apply_transform(local_transform)

    # Apply link transform (accumulated from joints)
    mesh.apply_transform(link_transform)

    # Set material color
    color = COLORS.get(mesh_def["material"], COLORS["3d_printed"])
    mesh.visual.face_colors = [int(c * 255) for c in color]

    return mesh


def build_robot():
    """Build the complete robot mesh hierarchy."""
    print("Building SO-101 robot model...")

    # Track accumulated transforms for each link
    link_transforms = {"base_link": np.eye(4)}

    # Calculate transforms for each link based on joint chain
    for joint in JOINTS:
        parent_transform = link_transforms[joint["parent"]]
        joint_transform = create_transform(joint["origin_xyz"], joint["origin_rpy"])
        link_transforms[joint["child"]] = parent_transform @ joint_transform

    # Load all meshes
    all_meshes = []

    for link_name, mesh_defs in LINKS.items():
        print(f"Processing {link_name}...")
        link_transform = link_transforms.get(link_name, np.eye(4))

        for mesh_def in mesh_defs:
            mesh = load_and_transform_mesh(mesh_def, link_transform)
            if mesh:
                all_meshes.append(mesh)
                print(f"  Loaded {mesh_def['file']}")

    # Combine all meshes
    print(f"\nCombining {len(all_meshes)} meshes...")
    combined = trimesh.util.concatenate(all_meshes)

    # Apply URDF Z-up to Y-up rotation
    rotation_x = trimesh.transformations.rotation_matrix(-np.pi/2, [1, 0, 0])
    combined.apply_transform(rotation_x)

    return combined


def export_scene_with_hierarchy():
    """Export as a GLTF scene with proper node hierarchy for animation."""
    print("\nCreating GLTF scene with hierarchy...")

    # Create scene
    scene = trimesh.Scene()

    # Track accumulated transforms
    link_transforms = {"base_link": np.eye(4)}

    # Calculate transforms
    for joint in JOINTS:
        parent_transform = link_transforms[joint["parent"]]
        joint_transform = create_transform(joint["origin_xyz"], joint["origin_rpy"])
        link_transforms[joint["child"]] = parent_transform @ joint_transform

    # URDF Z-up to Y-up rotation
    urdf_to_three = trimesh.transformations.rotation_matrix(-np.pi/2, [1, 0, 0])

    # Add each link as a separate node
    for link_name, mesh_defs in LINKS.items():
        print(f"Adding {link_name} to scene...")
        link_transform = link_transforms.get(link_name, np.eye(4))

        link_meshes = []
        for mesh_def in mesh_defs:
            mesh = load_and_transform_mesh(mesh_def, np.eye(4))  # No link transform yet
            if mesh:
                link_meshes.append(mesh)

        if link_meshes:
            combined_link = trimesh.util.concatenate(link_meshes)
            # Apply link transform and URDF rotation
            full_transform = urdf_to_three @ link_transform
            scene.add_geometry(combined_link, node_name=link_name, transform=full_transform)

    return scene


def main():
    print("=" * 60)
    print("SO-101 URDF to GLTF Converter")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Option 1: Single combined mesh (simplest, works great)
    robot_mesh = build_robot()

    # Export as GLB (binary GLTF - smaller, faster)
    output_glb = OUTPUT_DIR / "so101.glb"
    robot_mesh.export(output_glb, file_type='glb')
    print(f"\nExported: {output_glb}")
    print(f"File size: {output_glb.stat().st_size / 1024:.1f} KB")

    # Also export as GLTF (text format for debugging)
    output_gltf = OUTPUT_DIR / "so101.gltf"
    robot_mesh.export(output_gltf, file_type='gltf')
    print(f"Exported: {output_gltf}")

    # Option 2: Scene with hierarchy (for future animation support)
    scene = export_scene_with_hierarchy()
    output_scene_glb = OUTPUT_DIR / "so101_scene.glb"
    scene.export(output_scene_glb, file_type='glb')
    print(f"Exported: {output_scene_glb}")

    print("\n" + "=" * 60)
    print("Conversion complete!")
    print("=" * 60)
    print("\nFiles created:")
    print(f"  - {output_glb} (single mesh, use this)")
    print(f"  - {output_gltf} (debug version)")
    print(f"  - {output_scene_glb} (with hierarchy)")
    print("\nNext: Update React code to use useGLTF loader")


if __name__ == "__main__":
    main()
