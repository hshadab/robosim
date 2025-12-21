import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkedEpisodeRecorder, chunkedToStandardEpisode } from '../lib/chunkedRecorder';

describe('ChunkedEpisodeRecorder', () => {
  let recorder: ChunkedEpisodeRecorder;

  beforeEach(() => {
    recorder = new ChunkedEpisodeRecorder({ maxChunkSize: 10 });
  });

  describe('basic recording', () => {
    it('starts and stops recording', () => {
      expect(recorder.getIsRecording()).toBe(false);
      recorder.start('test-task');
      expect(recorder.getIsRecording()).toBe(true);
      const episode = recorder.stop({ task: 'test-task' });
      expect(recorder.getIsRecording()).toBe(false);
      expect(episode.metadata.task).toBe('test-task');
    });

    it('records frames', () => {
      recorder.start('test');
      recorder.addFrame({
        observation: { jointPositions: [0, 0, 0, 0, 0, 0] },
        action: { jointTargets: [10, 10, 10, 10, 10, 10] },
        done: false,
      });
      expect(recorder.getFrameCount()).toBe(1);

      const episode = recorder.stop();
      expect(episode.totalFrames).toBe(1);
    });

    it('ignores frames when not recording', () => {
      recorder.addFrame({
        observation: { jointPositions: [0, 0, 0, 0, 0, 0] },
        action: { jointTargets: [10, 10, 10, 10, 10, 10] },
        done: false,
      });
      expect(recorder.getFrameCount()).toBe(0);
    });
  });

  describe('chunking', () => {
    it('creates chunks when maxChunkSize is reached', () => {
      recorder.start('test');

      // Add 25 frames with maxChunkSize=10
      for (let i = 0; i < 25; i++) {
        recorder.addFrame({
          observation: { jointPositions: [i, i, i, i, i, i] },
          action: { jointTargets: [i + 1, i + 1, i + 1, i + 1, i + 1, i + 1] },
          done: i === 24,
        });
      }

      const episode = recorder.stop();
      expect(episode.totalFrames).toBe(25);
      expect(episode.chunks.length).toBe(3); // 10 + 10 + 5
      expect(episode.chunks[0].frames.length).toBe(10);
      expect(episode.chunks[1].frames.length).toBe(10);
      expect(episode.chunks[2].frames.length).toBe(5);
    });

    it('calls onChunkComplete callback', () => {
      const chunks: unknown[] = [];
      const recorderWithCallback = new ChunkedEpisodeRecorder({
        maxChunkSize: 5,
        onChunkComplete: (chunk) => chunks.push(chunk),
      });

      recorderWithCallback.start('test');
      for (let i = 0; i < 10; i++) {
        recorderWithCallback.addFrame({
          observation: { jointPositions: [i, i, i, i, i, i] },
          action: { jointTargets: [i, i, i, i, i, i] },
          done: false,
        });
      }
      // At this point we have exactly 10 frames = 2 complete chunks
      expect(chunks.length).toBe(2);

      recorderWithCallback.stop();
      // stop() doesn't add more frames, so no additional callback
      expect(chunks.length).toBe(2);
    });
  });

  describe('conversion', () => {
    it('converts to standard episode format', () => {
      recorder.start('test');
      for (let i = 0; i < 5; i++) {
        recorder.addFrame({
          observation: { jointPositions: [i, i, i, i, i, i] },
          action: { jointTargets: [i + 1, i + 1, i + 1, i + 1, i + 1, i + 1] },
          done: i === 4,
        });
      }
      const chunkedEpisode = recorder.stop({ task: 'conversion-test' });
      const standardEpisode = chunkedToStandardEpisode(chunkedEpisode);

      expect(standardEpisode.frames.length).toBe(5);
      expect(standardEpisode.metadata.task).toBe('conversion-test');
      expect(standardEpisode.frames[4].done).toBe(true);
    });
  });

  describe('metadata', () => {
    it('includes language instruction when provided', () => {
      recorder.start('test');
      recorder.addFrame({
        observation: { jointPositions: [0, 0, 0, 0, 0, 0] },
        action: { jointTargets: [0, 0, 0, 0, 0, 0] },
        done: true,
      });
      const episode = recorder.stop({
        task: 'pick-place',
        languageInstruction: 'Pick up the red block',
      });

      expect(episode.metadata.languageInstruction).toBe('Pick up the red block');
    });

    it('tracks duration correctly', async () => {
      recorder.start('test');
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = recorder.getDuration();
      // Allow some timing variance in tests
      expect(duration).toBeGreaterThanOrEqual(40);

      const episode = recorder.stop();
      expect(episode.metadata.duration).toBeGreaterThanOrEqual(40);
    });
  });
});
