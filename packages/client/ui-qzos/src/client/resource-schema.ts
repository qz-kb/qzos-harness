/** Fields and grouping from the existing QZOS knowledge and employee forms. */
import type { QzosKey } from './locales.ts'
export type PreviewValues = Record<string, string>
export interface PreviewField {
  id: string
  label: QzosKey
  kind: 'text' | 'textarea' | 'select' | 'radio' | 'range' | 'image' | 'knowledge'
  initial: string
  options?: readonly { value: string; label: QzosKey }[]
  required?: boolean
  locked?: boolean
  min?: number
  max?: number
  step?: number
  when?: readonly [string, string]
  unless?: readonly [string, string]
}
export const resourceForms = {
  'knowledgeCreate': [
    {
      'id': 'name',
      'label': 'pc1',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'intro',
      'label': 'pc2',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'embedding_model_id',
      'label': 'pc3',
      'kind': 'select',
      'initial': 'embedding',
      'locked': true,
      'options': [
        {
          'value': 'embedding',
          'label': 'pc4',
        },
      ],
    },
    {
      'id': 'documents_model_id',
      'label': 'pc5',
      'kind': 'select',
      'initial': 'deepseek',
      'locked': true,
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
    {
      'id': 'image',
      'label': 'pc7',
      'kind': 'image',
      'initial': '',
    },
  ],
  'knowledgeSettings': [
    {
      'id': 'name',
      'label': 'pc1',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'intro',
      'label': 'pc8',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'embedding_model_id',
      'label': 'pc3',
      'kind': 'select',
      'initial': 'embedding',
      'locked': true,
      'options': [
        {
          'value': 'embedding',
          'label': 'pc4',
        },
      ],
    },
    {
      'id': 'documents_model_id',
      'label': 'pc5',
      'kind': 'select',
      'initial': 'deepseek',
      'locked': true,
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
    {
      'id': 'external_enabled',
      'label': 'pc9',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'image',
      'label': 'pc12',
      'kind': 'image',
      'initial': '',
    },
  ],
  'employeeCreate': [
    {
      'id': 'name',
      'label': 'pc13',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'intro',
      'label': 'pc14',
      'kind': 'text',
      'initial': '',
    },
    {
      'id': 'roles_prompt',
      'label': 'pc15',
      'kind': 'textarea',
      'initial': '',
      'required': true,
    },
    {
      'id': 'kb_ids',
      'label': 'pc16',
      'kind': 'knowledge',
      'initial': '',
    },
    {
      'id': 'model_id',
      'label': 'pc17',
      'kind': 'select',
      'initial': 'deepseek',
      'required': true,
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
  ],
  'employeeBase': [
    {
      'id': 'image',
      'label': 'pc18',
      'kind': 'image',
      'initial': '',
    },
    {
      'id': 'name',
      'label': 'pc19',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'intro',
      'label': 'pc8',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'kb_ids',
      'label': 'pc16',
      'kind': 'knowledge',
      'initial': '',
    },
    {
      'id': 'roles_prompt',
      'label': 'pc20',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'icons',
      'label': 'pc21',
      'kind': 'image',
      'initial': '',
    },
    {
      'id': 'is_show_context',
      'label': 'pc22',
      'kind': 'radio',
      'initial': '1',
      'options': [
        {
          'value': '1',
          'label': 'pc23',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'is_show_quote',
      'label': 'pc24',
      'kind': 'radio',
      'initial': '1',
      'options': [
        {
          'value': '1',
          'label': 'pc23',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'is_show_feedback',
      'label': 'pc25',
      'kind': 'radio',
      'initial': '1',
      'options': [
        {
          'value': '1',
          'label': 'pc23',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'related_issues_num',
      'label': 'pc26',
      'kind': 'range',
      'initial': '0',
      'min': 0,
      'max': 10,
    },
  ],
  'employeeSearch': [
    {
      'id': 'model_id',
      'label': 'pc17',
      'kind': 'select',
      'initial': 'deepseek',
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
    {
      'id': 'temperature',
      'label': 'pc27',
      'kind': 'range',
      'initial': '0.7',
      'min': 0,
      'max': 1,
      'step': 0.1,
    },
    {
      'id': 'support_file',
      'label': 'pc28',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'search_empty_type',
      'label': 'pc29',
      'kind': 'radio',
      'initial': '1',
      'options': [
        {
          'value': '1',
          'label': 'pc30',
        },
        {
          'value': '2',
          'label': 'pc31',
        },
      ],
    },
    {
      'id': 'search_empty_text',
      'label': 'pc32',
      'kind': 'textarea',
      'initial': '',
      'when': [
        'search_empty_type',
        '2',
      ],
    },
    {
      'id': 'search_mode',
      'label': 'pc33',
      'kind': 'select',
      'initial': 'semantic',
      'options': [
        {
          'value': 'semantic',
          'label': 'pc34',
        },
        {
          'value': 'full',
          'label': 'pc35',
        },
        {
          'value': 'mix',
          'label': 'pc36',
        },
      ],
    },
    {
      'id': 'search_tokens',
      'label': 'pc37',
      'kind': 'range',
      'initial': '3000',
      'min': 100,
      'max': 30000,
    },
    {
      'id': 'context_num',
      'label': 'pc38',
      'kind': 'range',
      'initial': '3',
      'min': 0,
      'max': 20,
    },
    {
      'id': 'search_similar',
      'label': 'pc39',
      'kind': 'range',
      'initial': '0.6',
      'min': 0,
      'max': 1,
      'step': 0.01,
      'unless': [
        'search_mode',
        'full',
      ],
    },
    {
      'id': 'ranking_status',
      'label': 'pc40',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'ranking_score',
      'label': 'pc41',
      'kind': 'range',
      'initial': '0.5',
      'min': 0,
      'max': 1,
      'step': 0.01,
      'when': [
        'ranking_status',
        '1',
      ],
    },
    {
      'id': 'ranking_model',
      'label': 'pc42',
      'kind': 'select',
      'initial': 'rerank',
      'when': [
        'ranking_status',
        '1',
      ],
      'options': [
        {
          'value': 'rerank',
          'label': 'pc43',
        },
      ],
    },
    {
      'id': 'optimize_ask',
      'label': 'pc44',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'optimize_m_id',
      'label': 'pc45',
      'kind': 'select',
      'initial': 'deepseek',
      'when': [
        'optimize_ask',
        '1',
      ],
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
  ],
  'employeeInterface': [
    {
      'id': 'welcome_introducer',
      'label': 'pc46',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'copyright',
      'label': 'pc47',
      'kind': 'text',
      'initial': '',
    },
  ],
  'employeeFlow': [
    {
      'id': 'flow_status',
      'label': 'pc48',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'app_id',
      'label': 'pc49',
      'kind': 'text',
      'initial': '',
      'when': [
        'flow_status',
        '1',
      ],
    },
    {
      'id': 'workflow_id',
      'label': 'pc50',
      'kind': 'text',
      'initial': '',
      'when': [
        'flow_status',
        '1',
      ],
    },
    {
      'id': 'bot_id',
      'label': 'pc51',
      'kind': 'text',
      'initial': '',
      'when': [
        'flow_status',
        '1',
      ],
    },
    {
      'id': 'api_token',
      'label': 'pc52',
      'kind': 'text',
      'initial': '',
      'when': [
        'flow_status',
        '1',
      ],
    },
  ],
  'searchParameters': [
    {
      'id': 'search_mode',
      'label': 'pc33',
      'kind': 'select',
      'initial': 'semantic',
      'options': [
        {
          'value': 'semantic',
          'label': 'pc34',
        },
        {
          'value': 'full',
          'label': 'pc35',
        },
        {
          'value': 'mix',
          'label': 'pc36',
        },
      ],
    },
    {
      'id': 'search_tokens',
      'label': 'pc37',
      'kind': 'range',
      'initial': '3000',
      'min': 100,
      'max': 30000,
    },
    {
      'id': 'search_similar',
      'label': 'pc39',
      'kind': 'range',
      'initial': '0.6',
      'min': 0,
      'max': 1,
      'step': 0.01,
      'unless': [
        'search_mode',
        'full',
      ],
    },
    {
      'id': 'ranking_status',
      'label': 'pc53',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'ranking_score',
      'label': 'pc54',
      'kind': 'range',
      'initial': '0.5',
      'min': 0,
      'max': 1,
      'step': 0.01,
      'when': [
        'ranking_status',
        '1',
      ],
    },
    {
      'id': 'ranking_model',
      'label': 'pc42',
      'kind': 'select',
      'initial': 'rerank',
      'when': [
        'ranking_status',
        '1',
      ],
      'options': [
        {
          'value': 'rerank',
          'label': 'pc43',
        },
      ],
    },
    {
      'id': 'optimize_ask',
      'label': 'pc44',
      'kind': 'radio',
      'initial': '0',
      'options': [
        {
          'value': '1',
          'label': 'pc10',
        },
        {
          'value': '0',
          'label': 'pc11',
        },
      ],
    },
    {
      'id': 'optimize_m_id',
      'label': 'pc45',
      'kind': 'select',
      'initial': 'deepseek',
      'when': [
        'optimize_ask',
        '1',
      ],
      'options': [
        {
          'value': 'deepseek',
          'label': 'pc6',
        },
      ],
    },
  ],
  'share': [
    {
      'id': 'name',
      'label': 'pc13',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'password',
      'label': 'pc55',
      'kind': 'text',
      'initial': '',
    },
    {
      'id': 'welcome',
      'label': 'pc46',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'tips',
      'label': 'pc56',
      'kind': 'textarea',
      'initial': '',
    },
  ],
  'menu': [
    {
      'id': 'keyword',
      'label': 'pc57',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'content',
      'label': 'pc32',
      'kind': 'textarea',
      'initial': '',
    },
    {
      'id': 'images',
      'label': 'pc58',
      'kind': 'image',
      'initial': '',
    },
  ],
  'fragment': [
    {
      'id': 'question',
      'label': 'pc59',
      'kind': 'textarea',
      'initial': '',
      'required': true,
    },
    {
      'id': 'answer',
      'label': 'pc60',
      'kind': 'textarea',
      'initial': '',
    },
  ],
  'member': [
    {
      'id': 'nickname',
      'label': 'pc61',
      'kind': 'text',
      'initial': '',
      'required': true,
    },
    {
      'id': 'power',
      'label': 'pc62',
      'kind': 'select',
      'initial': 'view',
      'options': [
        {
          'value': 'edit',
          'label': 'pc63',
        },
        {
          'value': 'view',
          'label': 'pc64',
        },
        {
          'value': 'manage',
          'label': 'pc65',
        },
      ],
    },
  ],
} as const satisfies Record<string, readonly PreviewField[]>
export type ResourceForm = keyof typeof resourceForms
/** Combine original form defaults with the resource's browser-only values.
 * @param values - saved presentation values.
 * @returns a complete editable preview draft.
 */
export function resourceDraft(values: PreviewValues = {}): PreviewValues {
  const defaults = Object.values(resourceForms).flatMap(fields => fields.map((field): [string, string] => [field.id, field.initial]))
  return { ...Object.fromEntries(defaults), ...values }
}
