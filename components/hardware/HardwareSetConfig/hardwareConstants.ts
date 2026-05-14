import type { GroupByOption } from './hardwareHelpers';

/** Required column definitions for the hardware-set report — id, display label, description. */
export const REQUIRED_COLUMN_DEFS = [
  { id: 'hw_set_name',   label: 'HW Set',        desc: 'Hardware set name(s) this item belongs to' },
  { id: 'name',          label: 'Item Name',      desc: 'Hardware item name/description'            },
  { id: 'description',   label: 'Description',    desc: 'Detailed specifications'                   },
  { id: 'manufacturer',  label: 'Manufacturer',   desc: 'Brand/supplier name'                       },
  { id: 'finish',        label: 'Finish',         desc: 'Color/coating specification'               },
  { id: 'qty_per_set',   label: 'Qty/Set',        desc: 'Raw item quantity per hardware set'        },
  { id: 'quantity',      label: 'Total',          desc: 'Multiplied quantity (qty × doors)'         },
  { id: 'usage',         label: 'Usage',          desc: 'Door tags or quantity for this item'       },
  { id: 'door_material', label: 'Door Material',  desc: 'Materials of doors using this item'        },
];

/** Grouping mode options for the hardware-set report. */
export const GROUPING_OPTIONS: { id: GroupByOption; label: string; desc: string }[] = [
  { id: 'set',              label: 'By Hardware Set',      desc: 'One table per hardware set'            },
  { id: 'type',             label: 'By Item Type',         desc: 'Group by category (Hinges, Locksets…)' },
  { id: 'manufacturer',     label: 'By Manufacturer',      desc: 'Group by brand/supplier'               },
  { id: 'buildingTag',      label: 'By Building Tag',      desc: 'Group by building identifier'          },
  { id: 'buildingLocation', label: 'By Building Location', desc: 'Group by building location/floor'      },
  { id: 'doorMaterial',     label: 'By Door Material',     desc: 'Group by door material type'           },
  { id: 'flat',             label: 'Flat List',            desc: 'No grouping, single table'             },
];

/** Usage-display mode options — full tag list vs. count only. */
export const USAGE_OPTIONS = [
  { id: 'all',   label: 'Show all door tags', example: '101, 102, 103, 201...' },
  { id: 'count', label: 'Show count only',    example: 'Used in 6 doors'       },
];
