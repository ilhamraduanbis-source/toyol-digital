import test from 'node:test';
import assert from 'node:assert/strict';
import {auditResponse} from './audit.mjs';
const cases=[
  [
    "valid",
    {
      "status": 200,
      "body": {
        "items": [
          {
            "id": 1
          }
        ],
        "ok": true
      },
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/items/0/id",
            "type": "integer"
          },
          {
            "pointer": "/ok",
            "type": "boolean"
          }
        ]
      }
    },
    true,
    0
  ],
  [
    "wrong status",
    {
      "status": 500,
      "body": {},
      "contract": {
        "status": 200,
        "fields": []
      }
    },
    false,
    1
  ],
  [
    "missing",
    {
      "status": 200,
      "body": {},
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/id",
            "type": "string"
          }
        ]
      }
    },
    false,
    1
  ],
  [
    "optional",
    {
      "status": 200,
      "body": {},
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/id",
            "type": "string",
            "required": false
          }
        ]
      }
    },
    true,
    0
  ],
  [
    "wrong type",
    {
      "status": 200,
      "body": {
        "id": "1"
      },
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/id",
            "type": "integer"
          }
        ]
      }
    },
    false,
    1
  ],
  [
    "escaped pointer",
    {
      "status": 200,
      "body": {
        "a/b": {
          "~": null
        }
      },
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/a~1b/~0",
            "type": "null"
          }
        ]
      }
    },
    true,
    0
  ],
  [
    "root array",
    {
      "status": 200,
      "body": [
        1
      ],
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "",
            "type": "array"
          }
        ]
      }
    },
    true,
    0
  ],
  [
    "inherited field excluded",
    {
      "status": 200,
      "body": {},
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/constructor",
            "type": "object"
          }
        ]
      }
    },
    false,
    1
  ],
  [
    "array length excluded",
    {
      "status": 200,
      "body": [
        1
      ],
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/length",
            "type": "integer"
          }
        ]
      }
    },
    false,
    1
  ],
  [
    "invalid pointer",
    {
      "status": 200,
      "body": {},
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/x~2",
            "type": "string"
          }
        ]
      }
    },
    null,
    0
  ],
  [
    "duplicate pointer",
    {
      "status": 200,
      "body": {
        "x": 1
      },
      "contract": {
        "status": 200,
        "fields": [
          {
            "pointer": "/x",
            "type": "integer"
          },
          {
            "pointer": "/x",
            "type": "number"
          }
        ]
      }
    },
    null,
    0
  ],
  [
    "oversize",
    {
      "status": 200,
      "body": "REPEAT",
      "contract": {
        "status": 200,
        "fields": []
      }
    },
    null,
    0
  ]
];
for(const [name,input,expected,count] of cases)test(name,()=>{if(name==='oversize')input.body='x'.repeat(131073);if(expected===null){assert.throws(()=>auditResponse(input),TypeError);return;}const result=auditResponse(input);assert.equal(result.pass,expected);assert.equal(result.issueCount,count);});
