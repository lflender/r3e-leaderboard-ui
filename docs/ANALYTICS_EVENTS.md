# Analytics Event Contract

This document defines the canonical front-end analytics taxonomy used by page modules.

## Taxonomy

- Page lifecycle: `<page> page shown` (legacy exceptions retain their existing names).
- Emit once after the first usable content render, including an empty-results state.
  For pages whose initial interface does not require data, emit when that interface is ready.
  Loading and explicit error states alone do not count as a render. Automatic `$pageview`
  remains available for visits irrespective of data loading.
- User actions: `<page|entity> <action>` or `<page> <dimension> changed`
- Keep names stable and lowercase words separated by spaces.
- Prefer one canonical event per intent. Avoid emitting synonyms such as `viewed` and `displayed` for the same trigger.

## Canonical Events

| Event | Trigger | Required properties |
|---|---|---|
| `ranked page shown` | Ranked page renders the series or empty state | `series_count` |
| `driver page shown` | Drivers search interface is ready | `has_initial_search`, `initial_search_term`, `track_filter`, `class_filter` |
| `driver search performed` | Driver search executes (every search, before results arrive) | `search_term`, `source` |
| `driver search result viewed` | Driver search returns exactly one matching driver | `driver_name`, `search_term`, `track_filter`, `class_filter`, `source` |
| `driver info filter changed` | Driver track/class filter changes via user input | `filter_name`, `filter_value`, `search_term` |
| `driver pagination changed` | Driver results page changes | `page_number`, `total_pages`, `result_count` |
| `driver sort changed` | Driver results sort changes | `sort_by`, `previous_sort_by`, `result_count` |
| `leaderboard row opened` | User clicks a leaderboard row to open the detail page (driver or track page) | `track_id`, `class_id`, `superclass`, `position`, `has_driver_name`, `source_page`, `is_combined_view` |
| `leaderboards page shown` | Leaderboards page first successful data render | `displayed_rows`, `track_filter`, `class_filter`, `combine_mode` |
| `leaderboards filter changed` | Track/class/combine filters change | `filter_name`, `filter_value`, `track_filter`, `class_filter`, `combine_mode` |
| `track pagination changed` | Tracks table page changes | `page_number`, `total_pages`, `displayed_rows` |
| `cars page shown` | Cars page first render completes | `total_classes`, `total_cars`, `displayed_classes`, `displayed_cars`, `view_mode` |
| `car searched` | Cars search term is applied (debounced or enter) | `search_term`, `search_length`, `source`, `view_mode` |
| `cars toggled view` | Cars view toggles between table/tiles | `view_mode`, `previous_view_mode` |
| `car info filter changed` | Cars wheel/trans/class filter changes via user input | `filter_name`, `filter_value`, `displayed_cars`, `displayed_classes` |
| `detail page shown` | Detail page renders results or an empty state | `track_id`, `class_param`, `classes_param`, `superclass_param`, `car_param` |
| `detail filter changed` | Detail page car/difficulty filters change via user input | `selected_difficulty`, `selected_car`, `result_count` |
| `detail pagination changed` | Detail table page changes | `page_number`, `total_pages`, `result_count` |
| `driver profile page shown` | Driver profile page renders with data | `driver_name`, `country`, `total_entries`, `has_team`, `has_avatar` |
| `records page shown` | Records page first successful render completes | `filter_value`, `filter_label`, `filter_type` |
| `records filter changed` | Records class or country filter renders after a change | `filter_value`, `filter_label`, `filter_type`, `country_value`, `source` |
| `records country filter changed` | User selects or clears a Records country, regardless of render outcome | `country_value`, `filter_value` (active class/superclass) |
| `records action` | Records user action (fold/unfold/next/prev) | `action`, `record_type`, `filter_value`, `filter_label`, `filter_type` |
| `challenge page shown` | Challenge Picker interface is ready | `mode`, `car_granularity`, `track_granularity`, `group_by_category`, `hardcore`, `exclusions` |
| `challenge pick clicked` | User clicks the Pick button | `mode`, `car_granularity`, `track_granularity`, `group_by_category`, `hardcore`, `picked_class`, `picked_superclass`, `picked_track`, `picked_layout_id`, `exclusions` |
| `faq displayed` | FAQ page loads with questions | `question_count` |
| `faq question toggled` | User opens/closes an FAQ accordion item | `question_index`, `question`, `is_open`, `action` |
| `teams page shown` | Teams page renders results or an empty state | None |
| `team profile shown` | Team profile renders with data | `team_name` |

Records emits the country-change event immediately for each selection. The existing
`records filter changed` event is retained separately for the resulting render and
its row counts; rapid changes or failed renders may not produce that latter event.

## Deprecated Event Names

These legacy names have been replaced by canonical events:

- `car info displayed` -> `cars page shown`
- `car info view mode changed` -> `cars toggled view`
- `track info displayed` -> `leaderboards page shown`
- `detail page viewed` -> `detail page shown`
- `search result viewed` -> `driver search result viewed`
- `records displayed` -> `records page shown`
- `records section expanded` -> `records action` with `action=unfold`
