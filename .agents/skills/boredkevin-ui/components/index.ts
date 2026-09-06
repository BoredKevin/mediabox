import type { ComponentMeta } from '../schema/types';

import buttonMeta from './button.meta';
import cardMeta from './card.meta';
import inputMeta from './input.meta';
import badgeMeta from './badge.meta';
import dialogMeta from './dialog.meta';
import tabsMeta from './tabs.meta';
import dropdownMenuMeta from './dropdown-menu.meta';
import tooltipMeta from './tooltip.meta';
import accordionMeta from './accordion.meta';
import tableMeta from './table.meta';
import switchMeta from './switch.meta';
import sliderMeta from './slider.meta';
import calendarMeta from './calendar.meta';
import avatarMeta from './avatar.meta';
import separatorMeta from './separator.meta';
import cornerEdgesMeta from './corner-edges.meta';
import backgroundsMeta from './backgrounds.meta';

export const allComponentMetas: Record<string, ComponentMeta> = {
  button: buttonMeta,
  card: cardMeta,
  input: inputMeta,
  badge: badgeMeta,
  dialog: dialogMeta,
  tabs: tabsMeta,
  'dropdown-menu': dropdownMenuMeta,
  tooltip: tooltipMeta,
  accordion: accordionMeta,
  table: tableMeta,
  switch: switchMeta,
  slider: sliderMeta,
  calendar: calendarMeta,
  avatar: avatarMeta,
  separator: separatorMeta,
  'corner-edges': cornerEdgesMeta,
  backgrounds: backgroundsMeta,
};

export {
  buttonMeta,
  cardMeta,
  inputMeta,
  badgeMeta,
  dialogMeta,
  tabsMeta,
  dropdownMenuMeta,
  tooltipMeta,
  accordionMeta,
  tableMeta,
  switchMeta,
  sliderMeta,
  calendarMeta,
  avatarMeta,
  separatorMeta,
  cornerEdgesMeta,
  backgroundsMeta,
};

export default allComponentMetas;
