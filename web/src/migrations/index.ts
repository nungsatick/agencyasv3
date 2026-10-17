import * as migration_20261012_035645_initial from './20261012_035645_initial';
import * as migration_20261012_044341_extras from './20261012_044341_extras';
import * as migration_20261014_071816_topics from './20261014_071816_topics';
import * as migration_20261014_072116_dashboard_pin from './20261014_072116_dashboard_pin';
import * as migration_20261014_120449_topic_color_teal from './20261014_120449_topic_color_teal';
import * as migration_20261014_143408_idle_sessions from './20261014_143408_idle_sessions';
import * as migration_20261014_182756_mourning_gray_level from './20261014_182756_mourning_gray_level';
import * as migration_20261015_022539_google_analytics from './20261015_022539_google_analytics';
import * as migration_20261015_025612_account_requests from './20261015_025612_account_requests';
import * as migration_20261015_043645_name_en from './20261015_043645_name_en';
import * as migration_20261017_060459_guide_link_hits from './20261017_060459_guide_link_hits';
import * as migration_20261017_062154_central_form_defaults from './20261017_062154_central_form_defaults';

export const migrations = [
  {
    up: migration_20261012_035645_initial.up,
    down: migration_20261012_035645_initial.down,
    name: '20261012_035645_initial',
  },
  {
    up: migration_20261012_044341_extras.up,
    down: migration_20261012_044341_extras.down,
    name: '20261012_044341_extras',
  },
  {
    up: migration_20261014_071816_topics.up,
    down: migration_20261014_071816_topics.down,
    name: '20261014_071816_topics',
  },
  {
    up: migration_20261014_072116_dashboard_pin.up,
    down: migration_20261014_072116_dashboard_pin.down,
    name: '20261014_072116_dashboard_pin',
  },
  {
    up: migration_20261014_120449_topic_color_teal.up,
    down: migration_20261014_120449_topic_color_teal.down,
    name: '20261014_120449_topic_color_teal',
  },
  {
    up: migration_20261014_143408_idle_sessions.up,
    down: migration_20261014_143408_idle_sessions.down,
    name: '20261014_143408_idle_sessions',
  },
  {
    up: migration_20261014_182756_mourning_gray_level.up,
    down: migration_20261014_182756_mourning_gray_level.down,
    name: '20261014_182756_mourning_gray_level',
  },
  {
    up: migration_20261015_022539_google_analytics.up,
    down: migration_20261015_022539_google_analytics.down,
    name: '20261015_022539_google_analytics',
  },
  {
    up: migration_20261015_025612_account_requests.up,
    down: migration_20261015_025612_account_requests.down,
    name: '20261015_025612_account_requests',
  },
  {
    up: migration_20261015_043645_name_en.up,
    down: migration_20261015_043645_name_en.down,
    name: '20261015_043645_name_en',
  },
  {
    up: migration_20261017_060459_guide_link_hits.up,
    down: migration_20261017_060459_guide_link_hits.down,
    name: '20261017_060459_guide_link_hits',
  },
  {
    up: migration_20261017_062154_central_form_defaults.up,
    down: migration_20261017_062154_central_form_defaults.down,
    name: '20261017_062154_central_form_defaults'
  },
];
