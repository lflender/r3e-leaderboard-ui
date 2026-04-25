# Analytics Event Contract

This document defines the canonical front-end analytics taxonomy used by page modules.

## Taxonomy

- Page lifecycle: `<page> page shown`
- User actions: `<page|entity> <action>` or `<page> <dimension> changed`
- Keep names stable and lowercase words separated by spaces.
- Prefer one canonical event per intent. Avoid emitting synonyms such as `viewed` and `displayed` for the same trigger.

## Canonical Events

| Event | Trigger | Required properties |
|---|---|---|
| `daily races page shown` | Daily races home view is rendered with data | `sprint_races_count`, `feature_races_count`, `total_races_count` |
| `daily sprint race viewed` | User clicks a sprint race tile | `destination_url`, `track_id`, `class_id` |
| `daily feature race viewed` | User clicks a feature race tile | `destination_url`, `track_id`, `classes` |
| `driver page shown` | Drivers page initializes | `has_initial_search`, `initial_search_term`, `track_filter`, `class_filter` |
| `driver search performed` | Driver search executes (every search, before results arrive) | `search_term`, `source` |
| `driver search result viewed` | Driver search returns exactly one matching driver | `driver_name`, `search_term`, `track_filter`, `class_filter`, `source` |
| `driver info filter changed` | Driver track/class filter changes via user input | `filter_name`, `filter_value`, `search_term` |
| `driver pagination changed` | Driver results page changes | `page_number`, `total_pages`, `result_count` |
| `driver sort changed` | Driver results sort changes | `sort_by`, `previous_sort_by`, `result_count` |
| `leaderboard row opened` | User clicks a leaderboard row to open the detail page (driver or track page) | `track_id`, `class_id`, `superclass`, `position`, `has_driver_name`, `source_page`, `is_combined_view` |
| `track page shown` | Tracks page first successful data render | `displayed_rows`, `track_filter`, `class_filter`, `combine_mode` |
| `track info filter changed` | Track/class/combine filters change | `filter_name`, `filter_value`, `track_filter`, `class_filter`, `combine_mode` |
| `track pagination changed` | Tracks table page changes | `page_number`, `total_pages`, `displayed_rows` |
| `cars page shown` | Cars page first render completes | `total_classes`, `total_cars`, `displayed_classes`, `displayed_cars`, `view_mode` |
| `car searched` | Cars search term is applied (debounced or enter) | `search_term`, `search_length`, `source`, `view_mode` |
| `cars toggled view` | Cars view toggles between table/tiles | `view_mode`, `previous_view_mode` |
| `car info filter changed` | Cars wheel/trans/class filter changes via user input | `filter_name`, `filter_value`, `displayed_cars`, `displayed_classes` |
| `detail page shown` | Detail page initializes from URL params | `track_id`, `class_param`, `classes_param`, `superclass_param`, `car_param` |
| `detail filter changed` | Detail page car/difficulty filters change via user input | `selected_difficulty`, `selected_car`, `result_count` |
| `detail pagination changed` | Detail table page changes | `page_number`, `total_pages`, `result_count` |
| `records page shown` | Records page first successful render completes | `filter_value`, `filter_label`, `filter_type` |
| `records filter changed` | Records class/superclass filter changes via user input | `filter_value`, `filter_label`, `filter_type`, `source` |
| `records action` | Records user action (fold/unfold/next/prev) | `action`, `record_type`, `filter_value`, `filter_label`, `filter_type` |

## Deprecated Event Names

These legacy names have been replaced by canonical events:

- `car info displayed` -> `cars page shown`
- `car info view mode changed` -> `cars toggled view`
- `track info displayed` -> `track page shown`
- `detail page viewed` -> `detail page shown`
- `records displayed` -> `records page shown`
- `records section expanded` -> `records action` with `action=unfold`
