import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';
import { character } from './character.ts';

const initCharacter = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  logger.info({ name: character.name }, 'Name:');

  const mcpConfig = character.settings?.mcp || null;
  logger.info({ mcpConfig }, 'Character MCP config:');
  logger.info({ runtimeMcpBefore: runtime.getSetting('mcp') }, 'Runtime MCP before:');

  if (mcpConfig) {
    if (!runtime.character.settings) {
      runtime.character.settings = {};
    }

    runtime.character.settings.mcp = mcpConfig;
    (runtime as any).settings = {
      ...((runtime as any).settings || {}),
      mcp: mcpConfig,
    };

    logger.info(
      { runtimeCharacterMcp: runtime.character.settings?.mcp },
      'Runtime character.settings.mcp:'
    );
    logger.info({ runtimeMcpAfter: runtime.getSetting('mcp') }, 'Runtime MCP after manual patch:');

    const mcpService = runtime.getService('mcp' as never) as any;
    if (mcpService && typeof mcpService.initializeMcpServers === 'function') {
      await mcpService.initializeMcpServers();
      logger.info('MCP servers reinitialized from initCharacter');
    } else {
      logger.warn('MCP service not found or initializeMcpServers missing');
    }
  }
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  // plugins: [starterPlugin],
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';

export default project;
