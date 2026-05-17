import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendWidgetNotice,
  getVisibleWidgetNotice,
  isWidgetNoticeActive,
  truncateWidgetNotice,
  type WidgetNoticeState,
} from '../widget-status.ts';

test('appendWidgetNotice appends active transient notice to widget status', () => {
  const notice: WidgetNoticeState = {
    text: '梳理完成 + 目标更新',
    expiresAt: 6_000,
  };

  const text = appendWidgetNotice('Run:0 126.0k | 记:0+0 | 思:✗ | 理:✓', notice, 24, 1_000);
  assert.equal(text, 'Run:0 126.0k | 记:0+0 | 思:✗ | 理:✓ | 梳理完成 + 目标更新');
});

test('appendWidgetNotice omits expired transient notice after 5 seconds window', () => {
  const notice: WidgetNoticeState = {
    text: '反思完成',
    expiresAt: 5_000,
  };

  const text = appendWidgetNotice('Run:0 126.0k | 记:0+0 | 思:✗ | 理:✓', notice, 24, 5_000);
  assert.equal(text, 'Run:0 126.0k | 记:0+0 | 思:✗ | 理:✓');
  assert.equal(isWidgetNoticeActive(notice, 5_000), false);
});

test('truncateWidgetNotice limits transient notice length with ellipsis', () => {
  assert.equal(truncateWidgetNotice('检测到编排流程，GRC 已让行，需要暂停注入', 12), '检测到编排流程，GRC…');
});

test('getVisibleWidgetNotice returns latest notice content and old notice is effectively replaced by caller state overwrite', () => {
  const oldNotice: WidgetNoticeState = {
    text: '反思完成',
    expiresAt: 6_000,
  };
  const newNotice: WidgetNoticeState = {
    text: '已启动 post-round Reflector',
    expiresAt: 7_000,
  };

  assert.equal(getVisibleWidgetNotice(oldNotice, 24, 1_000), '反思完成');
  assert.equal(getVisibleWidgetNotice(newNotice, 24, 2_000), '已启动 post-round Reflector');
});
