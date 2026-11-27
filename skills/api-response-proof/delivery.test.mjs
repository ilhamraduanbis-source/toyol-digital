import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDelivery} from './delivery.mjs';
const cases=[
  [
    "complete",
    200,
    {
      "state": "complete",
      "items": [
        1,
        2
      ],
      "report": "result"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "PASS_DECLARED_CHECKS"
  ],
  [
    "false success",
    200,
    {
      "state": "failed",
      "items": [
        1,
        2
      ],
      "report": "result"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "partial delivery",
    200,
    {
      "state": "complete",
      "items": [
        1
      ],
      "report": "result"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "missing report",
    200,
    {
      "state": "complete",
      "items": [
        1,
        2
      ]
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "blank report",
    200,
    {
      "state": "complete",
      "items": [
        1,
        2
      ],
      "report": "  "
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "wrong HTTP",
    202,
    {
      "state": "complete",
      "items": [
        1,
        2
      ],
      "report": "result"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "type mismatch",
    200,
    {
      "state": "complete",
      "items": "12",
      "report": "result"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/state",
          "op": "equals",
          "value": "complete"
        },
        {
          "pointer": "/items",
          "op": "minItems",
          "value": 2
        },
        {
          "pointer": "/report",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "unsafe inherited pointer",
    200,
    {},
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/constructor",
          "op": "nonempty"
        }
      ]
    },
    "REVIEW"
  ],
  [
    "invalid empty policy",
    200,
    {},
    {
      "status": 200,
      "checks": []
    },
    null
  ],
  [
    "bad assertion",
    200,
    {},
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/a",
          "op": "minItems",
          "value": 0
        }
      ]
    },
    null
  ],
  [
    "strict equality",
    200,
    {
      "amount": "1"
    },
    {
      "status": 200,
      "checks": [
        {
          "pointer": "/amount",
          "op": "equals",
          "value": 1
        }
      ]
    },
    "REVIEW"
  ]
];
for(const [name,status,body,policy,expected] of cases)test(name,()=>{if(expected===null){assert.throws(()=>checkDelivery({status,body,policy}),TypeError);return;}assert.equal(checkDelivery({status,body,policy}).verdict,expected);});
