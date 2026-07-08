import { describe, it, expect, beforeEach } from 'vitest'
import { createIndex } from '../../helpers/instruction-indexer'


describe('createIndex().forFiles', () => {
  const INSTRUCTIONS_FIXTURE_PATTERN = '.opencode/plugins/tests/fixtures/copilot-instructions/*.instructions.md'

  let subject: Awaited<ReturnType<typeof createIndex>>

  beforeEach(async () => {
    subject = await createIndex({
      type: 'copilot',
      instructionsGlob: INSTRUCTIONS_FIXTURE_PATTERN,
      agent: 'build',
      currentWorkingDirectory: '/workspace'
    })
  })

  it('does not return any instructions for non existing files', async () => {
    const result = await subject.forFiles([
      '/workspace/non-existing-file.none'
    ]);

    expect(result.length).toBe(0)
  })

  it("returns well formed instructions metadata for matching files", async () => {
    const result = await subject.forFiles(['src/dir/some-file.ts']);

    const subjectInstruction = result.find(instruction => instruction.path.includes('multiple-glob-patterns.instructions.md'))

    const defaultInstructionDescription = expect.stringContaining('multiple-glob-patterns.instructions.md')

    if (!subjectInstruction) {
      throw new Error("Expected instruction not found in the result.")
    }

    expect(subjectInstruction).toBeDefined()
    expect(subjectInstruction.description).toEqual(defaultInstructionDescription)
    expect(subjectInstruction.applyTo).toEqual('**/*.{ts,js}')
    expect(subjectInstruction.path).toEqual('/workspace/.opencode/plugins/tests/fixtures/copilot-instructions/multiple-glob-patterns.instructions.md')
  })

  it('does not return instructions that dedicated for specific agents (appliesToAgents property)', async () => {
    const result = await subject.forFiles(['src/dir/some-file.ts']);

    const instructionFileName = 'only-specific-agents.instructions.md'

    expect(result).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining(instructionFileName)
      })
    ]))
  });


  it('does not return instructions that have no frontmatter', async () => {
    const result = await subject.forFiles(['src/dir/some-file.ts']);

    const instructionWithoutFrontmatterFileName = 'global-instruction-smpl.instructions.md'

    expect(result).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining(instructionWithoutFrontmatterFileName)
      })
    ]))
  });

  it('returns instructions that matched by file extension', async () => {
    const result = await subject.forFiles(['src/dir/some-file.ts']);

    const instructionFileName = 'multiple-glob-patterns.instructions.md'

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining(instructionFileName)
      })
    ]))
  });

  it('returns instructions matching by directory and subdirectory', async () => {
    const result = await subject.forFiles(['subfolder1/file']);

    const instructionFileName = 'multiple-subfolders.instructions.md'

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining(instructionFileName)
      })
    ]))
  });

  describe('when instruction has (excludePaths: "**.test.ts") property', () => {
    it('does not return instruction if all the files are excluded by the excludePaths property', async () => {
      const result = await subject.forFiles(['src/dir/some-file.test.ts']);

      const instructionFileName = 'excluded-paths.instructions.md'

      expect(result).toEqual(expect.not.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining(instructionFileName)
        })
      ]))
    });
  });

  describe("when instructions have global frontmatter", () => {
    it('does not return instructions that have global frontmatter (applyTo: "**")', async () => {
      const result = await subject.forFiles(['src/dir/some-file.ts']);

      const instructionsWithGlobalFrontmatter = ['global-frontmatter.instructions.md', 'global-frontmatter-normalized.instructions.md'];

      expect(result).toEqual(expect.not.arrayContaining(
        instructionsWithGlobalFrontmatter.map(instructionFileName =>
          expect.objectContaining({
            path: expect.stringContaining(instructionFileName)
          })
        )
      ));
    });
  })

  describe('when multiple files match the same instruction', () => {
    it('returns the instruction only once', async () => {
      const instructionFileName = 'multiple-glob-patterns.instructions.md';

      const result = await subject.forFiles(['dir/file1.ts', 'dir/file1.js']);

      const matchingInstructions = result.filter(instruction =>
        instruction.path.includes(instructionFileName)
      );

      expect(matchingInstructions.length).toBe(1);
    });
  })

  describe('when instructions have (appliesToAgents: "{agent1,agent2,team-*}") property', () => {
    beforeEach(async () => {
      subject = await createIndex({
        type: 'copilot',
        instructionsGlob: INSTRUCTIONS_FIXTURE_PATTERN,
        agent: 'agent1',
        currentWorkingDirectory: '/workspace'
      })
    })

    it('returns instructions without appliesToAgents property for matching files', async () => {
      const result = await subject.forFiles(['src/dir/some-file.ts']);

      const instructionFileName = 'multiple-glob-patterns.instructions.md'

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining(instructionFileName)
        })
      ]))
    })

    describe('when agent name is excluded by (excludeAgents: "team-excluded-member") property', () => {
      beforeEach(async () => {
        subject = await createIndex({
          type: 'copilot',
          instructionsGlob: INSTRUCTIONS_FIXTURE_PATTERN,
          agent: 'team-excluded-member',
          currentWorkingDirectory: '/workspace'
        })
      })

      it('does not return instructions that are excluded by excludeAgents property', async () => {
        const result = await subject.forFiles(['src/dir/some-file.ts']);

        const instructionFileName = 'excluded-agents.instructions.md';

        expect(result).toEqual(expect.not.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining(instructionFileName)
          })
        ]));
      });
    })
  })
})
