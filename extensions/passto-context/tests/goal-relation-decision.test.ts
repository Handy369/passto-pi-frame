import test from 'node:test';
import assert from 'node:assert/strict';

import { projectGeneratorCharterPrompt, readGeneratorContract } from '../grc-generator-contract.ts';
import { applyUserGoalProjectionToObjectState } from '../grc-user-goal-projection.ts';
import { createApplyUserGoalProjectionToolParams } from '../grc-user-goal-projection-tool.ts';

const NOW = '2026-05-22T00:00:00.000Z';

test('P2 GoalRelationDecision is accepted as LLM-owned projection context and does not mutate state by itself', () => {
  const initial = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-focus', assertion: '当前焦点目标', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 10,
    nowIso: NOW,
  });

  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: initial.userGoalTree, xNodeModels: initial.xNodeModels },
    goalRelationDecision: {
      relation: 'update_current_focus',
      focusUserGoalIdBefore: 'goal-focus',
      targetUserGoalId: 'goal-focus',
      targetXNodeModelId: 'xnode-goal-focus',
      targetXNodeId: 'goal-focus',
      parentUserGoalId: null,
      producesNewUserGoal: false,
      shouldCreateXNodeModel: false,
      evidence: ['用户说“同意，进入 P2”，语义上延续当前修复计划'],
      confidence: 'high',
    },
    userGoalOps: [{ action: 'update_user_goal', id: 'goal-focus', assertion: '继续当前焦点目标', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });

  assert.equal(result.userGoalTree.userGoals.length, 1);
  assert.equal(result.xNodeModels.length, 1);
  assert.equal(result.userGoalTree.userGoals[0]?.id, 'goal-focus');
  assert.equal(result.userGoalTree.userGoals[0]?.xNodeModelId, 'xnode-goal-focus');
  assert.equal(result.xNodeModels[0]?.id, 'xnode-goal-focus');
  assert.equal(result.xNodeModels[0]?.userGoalId, 'goal-focus');
  assert.equal(result.warnings.length, 0);
});

test('P2 GoalRelationDecision warns when it says no new user goal but create_user_goal is requested', () => {
  const initial = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-focus', assertion: '当前焦点目标', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 10,
    nowIso: NOW,
  });

  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: initial.userGoalTree, xNodeModels: initial.xNodeModels },
    goalRelationDecision: {
      relation: 'update_current_focus',
      focusUserGoalIdBefore: 'goal-focus',
      targetUserGoalId: 'goal-focus',
      targetXNodeModelId: 'xnode-goal-focus',
      targetXNodeId: 'goal-focus',
      parentUserGoalId: null,
      producesNewUserGoal: false,
      shouldCreateXNodeModel: false,
      evidence: ['用户输入是当前目标的补充，不是新目标'],
      confidence: 'high',
    },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-accidental-new', assertion: '误建新目标' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });

  assert.match(
    result.warnings.join('\n'),
    /goal-relation-decision mismatch.*producesNewUserGoal=false.*create_user_goal/,
  );
});

test('P2 applyUserGoalProjection tool schema exposes optional goalRelationDecision contract', () => {
  const calls: Array<{ kind: string; properties?: Record<string, unknown>; options?: Record<string, unknown> }> = [];
  const Type = {
    Object: (properties: Record<string, unknown>, options?: Record<string, unknown>) => {
      calls.push({ kind: 'Object', properties, options });
      return { kind: 'Object', properties, options };
    },
    Array: (items: unknown, options?: Record<string, unknown>) => ({ kind: 'Array', items, options }),
    Optional: (schema: unknown) => ({ kind: 'Optional', schema }),
    Union: (schemas: unknown[]) => ({ kind: 'Union', schemas }),
    Literal: (value: string) => ({ kind: 'Literal', value }),
    String: (options?: Record<string, unknown>) => ({ kind: 'String', options }),
    Null: () => ({ kind: 'Null' }),
    Boolean: () => ({ kind: 'Boolean' }),
  };

  const schema = createApplyUserGoalProjectionToolParams(Type);

  assert.equal((schema as { kind: string }).kind, 'Object');
  assert.ok((schema as { properties: Record<string, unknown> }).properties.goalRelationDecision);
  assert.match(JSON.stringify(schema), /new_root/);
  assert.match(JSON.stringify(schema), /update_current_focus/);
  assert.match(JSON.stringify(schema), /producesNewUserGoal/);
});

test('P2 generator charter instructs GoalRelationDecision before projection', () => {
  const prompt = projectGeneratorCharterPrompt(readGeneratorContract());

  assert.match(prompt, /GoalRelationDecision/);
  assert.match(prompt, /第一段只判断用户输入与 userGoalTree 的关系/);
  assert.match(prompt, /脚本只校验/);
  assert.match(prompt, /producesNewUserGoal/);
});
