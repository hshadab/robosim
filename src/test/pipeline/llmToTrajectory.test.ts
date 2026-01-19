/**
 * LLM to Trajectory Pipeline Tests
 *
 * Tests the first stage of the pipeline: parsing LLM responses into validated trajectories.
 */

import { describe, it, expect } from 'vitest';
import { processLLMToTrajectory } from '../utils/pipelineHelpers';
import {
  VALID_LLM_RESPONSES,
  INVALID_LLM_RESPONSES,
  LLM_RESPONSE_MARKDOWN,
} from '../fixtures/llmResponses';

describe('LLM to Trajectory Pipeline', () => {
  // ============================================================================
  // Valid Response Parsing
  // ============================================================================

  describe('Valid LLM Responses', () => {
    it('should parse valid pickup cube response', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);

      expect(result.success).toBe(true);
      expect(result.trajectory).toBeDefined();
      expect(result.trajectory!.frames.length).toBeGreaterThan(0);
      expect(result.trajectory!.metadata?.action).toBe('pickup');
    });

    it('should parse valid stack blocks response', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.stackBlocks);

      expect(result.success).toBe(true);
      expect(result.trajectory).toBeDefined();
      expect(result.trajectory!.metadata?.action).toBe('stack');
    });

    it('should parse valid place object response', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.placeObject);

      expect(result.success).toBe(true);
      expect(result.trajectory!.metadata?.action).toBe('place');
    });

    it('should parse single move command', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.singleMove);

      expect(result.success).toBe(true);
      expect(result.trajectory!.frames.length).toBe(2);
    });

    it('should parse response with different object types', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.cylinderPickup);

      expect(result.success).toBe(true);
      expect(result.trajectory!.metadata?.objectType).toBe('cylinder');
    });
  });

  // ============================================================================
  // Markdown Parsing
  // ============================================================================

  describe('Markdown Code Block Parsing', () => {
    it('should extract JSON from markdown code block', () => {
      const result = processLLMToTrajectory(LLM_RESPONSE_MARKDOWN.withCodeBlock);

      expect(result.success).toBe(true);
      expect(result.trajectory).toBeDefined();
    });

    it('should extract JSON from labeled code block', () => {
      const result = processLLMToTrajectory(LLM_RESPONSE_MARKDOWN.withJsonLabel);

      expect(result.success).toBe(true);
      expect(result.trajectory).toBeDefined();
    });

    it('should parse plain JSON string', () => {
      const plainJson = JSON.stringify(VALID_LLM_RESPONSES.singleMove);
      const result = processLLMToTrajectory(plainJson);

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Invalid Response Handling
  // ============================================================================

  describe('Invalid LLM Responses', () => {
    it('should reject malformed JSON', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.malformedJson);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('parse_error');
      expect(result.error?.recoverable).toBe(true);
    });

    it('should reject response with missing required fields', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.missingFields);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('structure');
    });

    it('should reject empty sequence', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.emptySequence);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('structure');
      expect(result.error?.message).toContain('Empty');
    });

    it('should reject out of bounds joint positions', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.outOfBoundsJoints);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('joint_limits');
    });

    it('should reject excessive velocity', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.excessiveVelocity);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('velocity');
    });

    it('should reject non-monotonic timestamps', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.nonMonotonicTimestamp);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('validation_error');
      expect(result.error?.message).toContain('monotonic');
    });

    it('should reject invalid timestamp types', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.invalidTimestampType);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('validation_error');
    });

    it('should reject gripper close that is too fast for pickup', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.gripperTooFast);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('gripper_timing');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle object input (not string)', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);

      expect(result.success).toBe(true);
    });

    it('should handle null input', () => {
      const result = processLLMToTrajectory(null);

      expect(result.success).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = processLLMToTrajectory(undefined);

      expect(result.success).toBe(false);
    });

    it('should handle array input (invalid structure)', () => {
      const result = processLLMToTrajectory([1, 2, 3]);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('structure');
    });

    it('should preserve metadata from LLM response', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);

      expect(result.success).toBe(true);
      expect(result.trajectory?.metadata?.objectType).toBeDefined();
      expect(result.trajectory?.metadata?.objectPosition).toBeDefined();
    });
  });

  // ============================================================================
  // Frame Validation
  // ============================================================================

  describe('Frame Validation', () => {
    it('should validate all joints in each frame', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);

      expect(result.success).toBe(true);
      for (const frame of result.trajectory!.frames) {
        expect(frame.joints).toBeDefined();
        expect(frame.timestamp).toBeGreaterThanOrEqual(0);
      }
    });

    it('should enforce timestamp ordering', () => {
      const result = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);

      expect(result.success).toBe(true);
      const frames = result.trajectory!.frames;
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].timestamp).toBeGreaterThan(frames[i - 1].timestamp);
      }
    });

    it('should check velocity between consecutive frames', () => {
      // The excessive velocity response should fail
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.excessiveVelocity);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('velocity');
      expect(result.error?.details?.velocity).toBeGreaterThan(0);
    });
  });
});
