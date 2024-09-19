// @ts-nocheck
export const postmanMock = {
  info: {
    _postman_id: "17ed84ae-6661-4a29-9337-c647765affe5",
    name: "Pet Store Contract Test",
    description:
      "This is a sample server Petstore server.  You can find out more about Swagger at [http://swagger.io](http://swagger.io) or on [irc.freenode.net, #swagger](http://swagger.io/irc/).  For this sample, you can use the api key `special-key` to test the authorization filters.\n\nContact Support:\n Email: apiteam@swagger.io",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    _exporter_id: "38446935",
    _collection_link:
      "https://www.postman.com/solar-shadow-608598/my-workspace/collection/awhyu4b/pet-store-contract-test?action=share&source=collection_link&creator=38446935",
  },
  item: [
    {
      name: "pet",
      item: [
        {
          name: "{pet Id}",
          item: [
            {
              name: "Find pet by ID",
              request: {
                auth: {
                  type: "apikey",
                  apikey: [
                    {
                      key: "key",
                      value: "api_key",
                      type: "string",
                    },
                    {
                      key: "value",
                      value: "\u003CAPI Key\u003E",
                      type: "string",
                    },
                    {
                      key: "in",
                      value: "header",
                      type: "string",
                    },
                  ],
                },
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/pet/:petId",
                  host: ["{{baseUrl}}"],
                  path: ["pet", ":petId"],
                  variable: [
                    {
                      key: "petId",
                      value: "78435736",
                      description: "(Required) ID of pet to return",
                    },
                  ],
                },
                description: "Returns a single pet",
              },
              response: [
                {
                  name: "successful operation",
                  originalRequest: {
                    method: "GET",
                    header: [
                      {
                        key: "api_key",
                        value: "\u003CAPI Key\u003E",
                        description:
                          "Added as a part of security scheme: apikey",
                      },
                    ],
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) ID of pet to return",
                        },
                      ],
                    },
                  },
                  status: "OK",
                  code: 200,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "application/json",
                    },
                  ],
                  cookie: [],
                  body: '{\n "name": -39998307,\n "photoUrls": [\n  "ex officia dolore",\n  "incididunt deserunt"\n ],\n "id": 67631046,\n "category": {\n  "id": -13761159,\n  "name": "amet Excepteur"\n },\n "tags": [\n  {\n   "id": 42053537,\n   "name": "adipisicing exercitation eiusmod ipsum"\n  },\n  {\n   "id": 86679159,\n   "name": "in proident elit adipisicing officia"\n  }\n ],\n "status": "pending"\n}',
                },
                {
                  name: "Invalid ID supplied",
                  originalRequest: {
                    method: "GET",
                    header: [
                      {
                        key: "api_key",
                        value: "\u003CAPI Key\u003E",
                        description:
                          "Added as a part of security scheme: apikey",
                      },
                    ],
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) ID of pet to return",
                        },
                      ],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
                {
                  name: "Pet not found",
                  originalRequest: {
                    method: "GET",
                    header: [
                      {
                        key: "api_key",
                        value: "\u003CAPI Key\u003E",
                        description:
                          "Added as a part of security scheme: apikey",
                      },
                    ],
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) ID of pet to return",
                        },
                      ],
                    },
                  },
                  status: "Not Found",
                  code: 404,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
            {
              name: "Updates a pet in the store with form data",
              request: {
                auth: {
                  type: "oauth2",
                },
                method: "POST",
                header: [
                  {
                    key: "Content-Type",
                    value: "application/x-www-form-urlencoded",
                  },
                ],
                body: {
                  mode: "urlencoded",
                  urlencoded: [
                    {
                      key: "name",
                      value: "commodo eiusmod",
                      description: "Updated name of the pet",
                    },
                    {
                      key: "status",
                      value: "anim laborum nostrud ",
                      description: "Updated status of the pet",
                    },
                  ],
                },
                url: {
                  raw: "{{baseUrl}}/pet/:petId",
                  host: ["{{baseUrl}}"],
                  path: ["pet", ":petId"],
                  variable: [
                    {
                      key: "petId",
                      value: "78435736",
                      description:
                        "(Required) ID of pet that needs to be updated",
                    },
                  ],
                },
              },
              response: [
                {
                  name: "Invalid input",
                  originalRequest: {
                    method: "POST",
                    header: [
                      {
                        key: "Authorization",
                        value: "\u003Ctoken\u003E",
                        description:
                          "Added as a part of security scheme: oauth2",
                      },
                    ],
                    body: {
                      mode: "urlencoded",
                      urlencoded: [
                        {
                          key: "name",
                          value: "commodo eiusmod",
                          description: "Updated name of the pet",
                        },
                        {
                          key: "status",
                          value: "anim laborum nostrud ",
                          description: "Updated status of the pet",
                        },
                      ],
                    },
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description:
                            "(Required) ID of pet that needs to be updated",
                        },
                      ],
                    },
                  },
                  status: "Method Not Allowed",
                  code: 405,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
            {
              name: "Deletes a pet",
              request: {
                auth: {
                  type: "oauth2",
                },
                method: "DELETE",
                header: [
                  {
                    key: "api_key",
                    value: "et c",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/pet/:petId",
                  host: ["{{baseUrl}}"],
                  path: ["pet", ":petId"],
                  variable: [
                    {
                      key: "petId",
                      value: "78435736",
                      description: "(Required) Pet id to delete",
                    },
                  ],
                },
              },
              response: [
                {
                  name: "Invalid ID supplied",
                  originalRequest: {
                    method: "DELETE",
                    header: [
                      {
                        key: "Authorization",
                        value: "\u003Ctoken\u003E",
                        description:
                          "Added as a part of security scheme: oauth2",
                      },
                      {
                        key: "api_key",
                        value: "et c",
                      },
                    ],
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) Pet id to delete",
                        },
                      ],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
                {
                  name: "Pet not found",
                  originalRequest: {
                    method: "DELETE",
                    header: [
                      {
                        key: "Authorization",
                        value: "\u003Ctoken\u003E",
                        description:
                          "Added as a part of security scheme: oauth2",
                      },
                      {
                        key: "api_key",
                        value: "et c",
                      },
                    ],
                    url: {
                      raw: "{{baseUrl}}/pet/:petId",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) Pet id to delete",
                        },
                      ],
                    },
                  },
                  status: "Not Found",
                  code: 404,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
            {
              name: "uploads an image",
              request: {
                auth: {
                  type: "oauth2",
                },
                method: "POST",
                header: [
                  {
                    key: "Content-Type",
                    value: "multipart/form-data",
                  },
                ],
                body: {
                  mode: "formdata",
                  formdata: [
                    {
                      key: "additionalMetadata",
                      value: "nostrud exercita",
                      description: "Additional data to pass to server",
                      type: "text",
                    },
                    {
                      key: "file",
                      description: "file to upload",
                      type: "file",
                      src: [],
                    },
                  ],
                },
                url: {
                  raw: "{{baseUrl}}/pet/:petId/uploadImage",
                  host: ["{{baseUrl}}"],
                  path: ["pet", ":petId", "uploadImage"],
                  variable: [
                    {
                      key: "petId",
                      value: "78435736",
                      description: "(Required) ID of pet to update",
                    },
                  ],
                },
              },
              response: [
                {
                  name: "successful operation",
                  originalRequest: {
                    method: "POST",
                    header: [
                      {
                        key: "Authorization",
                        value: "\u003Ctoken\u003E",
                        description:
                          "Added as a part of security scheme: oauth2",
                      },
                    ],
                    body: {
                      mode: "formdata",
                      formdata: [
                        {
                          key: "additionalMetadata",
                          value: "nostrud exercita",
                          description: "Additional data to pass to server",
                          type: "text",
                        },
                        {
                          key: "file",
                          description: "file to upload",
                          type: "file",
                          src: [],
                        },
                      ],
                    },
                    url: {
                      raw: "{{baseUrl}}/pet/:petId/uploadImage",
                      host: ["{{baseUrl}}"],
                      path: ["pet", ":petId", "uploadImage"],
                      variable: [
                        {
                          key: "petId",
                          value: "78435736",
                          description: "(Required) ID of pet to update",
                        },
                      ],
                    },
                  },
                  status: "OK",
                  code: 200,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "application/json",
                    },
                  ],
                  cookie: [],
                  body: '{\n "code": 33428946,\n "type": "aliqua est sunt proident",\n "message": "laboris"\n}',
                },
              ],
            },
          ],
        },
        {
          name: "Update an existing pet",
          request: {
            auth: {
              type: "oauth2",
            },
            method: "PUT",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: '{\n "name": -39998307,\n "photoUrls": [\n  "ipsum ea",\n  "consectetur sunt"\n ],\n "id": -74288835,\n "category": {\n  "id": 71199307,\n  "name": "mollit ad"\n },\n "tags": [\n  {\n   "id": 33293341,\n   "name": "voluptate c"\n  },\n  {\n   "id": -43521516,\n   "name": "dolor cupidatat ex incididunt ea"\n  }\n ],\n "status": "pending"\n}',
              options: {
                raw: {
                  language: "json",
                },
              },
            },
            url: {
              raw: "{{baseUrl}}/pet",
              host: ["{{baseUrl}}"],
              path: ["pet"],
            },
          },
          response: [
            {
              name: "Invalid ID supplied",
              originalRequest: {
                method: "PUT",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "name": "doggie",\n    "photoUrls": [\n        "ex officia dolore",\n        "incididunt deserunt"\n    ],\n    "id": 67631046,\n    "category": {\n        "id": -13761159,\n        "name": "amet Excepteur"\n    },\n    "tags": [\n        {\n            "id": 42053537,\n            "name": "adipisicing exercitation eiusmod ipsum"\n        },\n        {\n            "id": 86679159,\n            "name": "in proident elit adipisicing officia"\n        }\n    ],\n    "status": "pending"\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/pet",
                  host: ["{{baseUrl}}"],
                  path: ["pet"],
                },
              },
              status: "Bad Request",
              code: 400,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
            {
              name: "Pet not found",
              originalRequest: {
                method: "PUT",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "name": "doggie",\n    "photoUrls": [\n        "ex officia dolore",\n        "incididunt deserunt"\n    ],\n    "id": 67631046,\n    "category": {\n        "id": -13761159,\n        "name": "amet Excepteur"\n    },\n    "tags": [\n        {\n            "id": 42053537,\n            "name": "adipisicing exercitation eiusmod ipsum"\n        },\n        {\n            "id": 86679159,\n            "name": "in proident elit adipisicing officia"\n        }\n    ],\n    "status": "pending"\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/pet",
                  host: ["{{baseUrl}}"],
                  path: ["pet"],
                },
              },
              status: "Not Found",
              code: 404,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
            {
              name: "Validation exception",
              originalRequest: {
                method: "PUT",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "name": "doggie",\n    "photoUrls": [\n        "ex officia dolore",\n        "incididunt deserunt"\n    ],\n    "id": 67631046,\n    "category": {\n        "id": -13761159,\n        "name": "amet Excepteur"\n    },\n    "tags": [\n        {\n            "id": 42053537,\n            "name": "adipisicing exercitation eiusmod ipsum"\n        },\n        {\n            "id": 86679159,\n            "name": "in proident elit adipisicing officia"\n        }\n    ],\n    "status": "pending"\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/pet",
                  host: ["{{baseUrl}}"],
                  path: ["pet"],
                },
              },
              status: "Method Not Allowed",
              code: 405,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Add a new pet to the store",
          request: {
            auth: {
              type: "oauth2",
            },
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: '{\n "name": -39998307,\n "photoUrls": [\n  "ex officia dolore",\n  "incididunt deserunt"\n ],\n "id": 67631046,\n "category": {\n  "id": -13761159,\n  "name": "amet Excepteur"\n },\n "tags": [\n  {\n   "id": 42053537,\n   "name": "adipisicing exercitation eiusmod ipsum"\n  },\n  {\n   "id": 86679159,\n   "name": "in proident elit adipisicing officia"\n  }\n ],\n "status": "pending"\n}',
              options: {
                raw: {
                  language: "json",
                },
              },
            },
            url: {
              raw: "{{baseUrl}}/pet",
              host: ["{{baseUrl}}"],
              path: ["pet"],
            },
          },
          response: [
            {
              name: "Invalid input",
              originalRequest: {
                method: "POST",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "name": "doggie",\n    "photoUrls": [\n        "ex officia dolore",\n        "incididunt deserunt"\n    ],\n    "id": 67631046,\n    "category": {\n        "id": -13761159,\n        "name": "amet Excepteur"\n    },\n    "tags": [\n        {\n            "id": 42053537,\n            "name": "adipisicing exercitation eiusmod ipsum"\n        },\n        {\n            "id": 86679159,\n            "name": "in proident elit adipisicing officia"\n        }\n    ],\n    "status": "pending"\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/pet",
                  host: ["{{baseUrl}}"],
                  path: ["pet"],
                },
              },
              status: "Method Not Allowed",
              code: 405,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Finds Pets by status",
          request: {
            auth: {
              type: "oauth2",
            },
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/pet/findByStatus?status=available&status=available",
              host: ["{{baseUrl}}"],
              path: ["pet", "findByStatus"],
              query: [
                {
                  key: "status",
                  value: "available",
                  description:
                    "(Required) Status values that need to be considered for filter",
                },
                {
                  key: "status",
                  value: "available",
                  description:
                    "(Required) Status values that need to be considered for filter",
                },
              ],
            },
            description:
              "Multiple status values can be provided with comma separated strings",
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "GET",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/pet/findByStatus?status=available&status=available",
                  host: ["{{baseUrl}}"],
                  path: ["pet", "findByStatus"],
                  query: [
                    {
                      key: "status",
                      value: "available",
                    },
                    {
                      key: "status",
                      value: "available",
                    },
                  ],
                },
              },
              status: "OK",
              code: 200,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              cookie: [],
              body: '[\n {\n  "name": -33797866,\n  "photoUrls": [\n   "ipsum in",\n   "anim aliqua"\n  ],\n  "id": -5747069,\n  "category": {\n   "id": 9395204,\n   "name": "est tempor"\n  },\n  "tags": [\n   {\n    "id": 36986951,\n    "name": "cupidatat"\n   },\n   {\n    "id": 5246097,\n    "name": "consequat sint voluptate non"\n   }\n  ],\n  "status": "pending"\n },\n {\n  "name": 1544319,\n  "photoUrls": [\n   "sed in culpa ali",\n   "ut cupidatat in"\n  ],\n  "id": 34959708,\n  "category": {\n   "id": 88049464,\n   "name": "id dolor consectetur voluptate"\n  },\n  "tags": [\n   {\n    "id": -88330972,\n    "name": "id pariatur occaecat tempor"\n   },\n   {\n    "id": 91673103,\n    "name": "ut ipsum"\n   }\n  ],\n  "status": "available"\n }\n]',
            },
            {
              name: "Invalid status value",
              originalRequest: {
                method: "GET",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/pet/findByStatus?status=available&status=available",
                  host: ["{{baseUrl}}"],
                  path: ["pet", "findByStatus"],
                  query: [
                    {
                      key: "status",
                      value: "available",
                    },
                    {
                      key: "status",
                      value: "available",
                    },
                  ],
                },
              },
              status: "Bad Request",
              code: 400,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Finds Pets by tags",
          request: {
            auth: {
              type: "oauth2",
            },
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/store/findByTags?tags=laborum proident esse fugiat&tags=velit veniam",
              host: ["{{baseUrl}}"],
              path: ["store", "findByTags"],
              query: [
                {
                  key: "tags",
                  value: "laborum proident esse fugiat",
                  description: "(Required) Tags to filter by",
                },
                {
                  key: "tags",
                  value: "velit veniam",
                  description: "(Required) Tags to filter by",
                },
              ],
            },
            description:
              "Multiple tags can be provided with comma separated strings. Use tag1, tag2, tag3 for testing.",
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "GET",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/pet/findByTags?tags=qui non irure&tags=occaecat do est magna",
                  host: ["{{baseUrl}}"],
                  path: ["pet", "findByTags"],
                  query: [
                    {
                      key: "tags",
                      value: "qui non irure",
                    },
                    {
                      key: "tags",
                      value: "occaecat do est magna",
                    },
                  ],
                },
              },
              status: "OK",
              code: 200,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              cookie: [],
              body: '[\n {\n  "name": -33797866,\n  "photoUrls": [\n   "ipsum in",\n   "anim aliqua"\n  ],\n  "id": -5747069,\n  "category": {\n   "id": 9395204,\n   "name": "est tempor"\n  },\n  "tags": [\n   {\n    "id": 36986951,\n    "name": "cupidatat"\n   },\n   {\n    "id": 5246097,\n    "name": "consequat sint voluptate non"\n   }\n  ],\n  "status": "pending"\n },\n {\n  "name": 1544319,\n  "photoUrls": [\n   "sed in culpa ali",\n   "ut cupidatat in"\n  ],\n  "id": 34959708,\n  "category": {\n   "id": 88049464,\n   "name": "id dolor consectetur voluptate"\n  },\n  "tags": [\n   {\n    "id": -88330972,\n    "name": "id pariatur occaecat tempor"\n   },\n   {\n    "id": 91673103,\n    "name": "ut ipsum"\n   }\n  ],\n  "status": "available"\n }\n]',
            },
            {
              name: "Invalid tag value",
              originalRequest: {
                method: "GET",
                header: [
                  {
                    key: "Authorization",
                    value: "\u003Ctoken\u003E",
                    description: "Added as a part of security scheme: oauth2",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/pet/findByTags?tags=qui non irure&tags=occaecat do est magna",
                  host: ["{{baseUrl}}"],
                  path: ["pet", "findByTags"],
                  query: [
                    {
                      key: "tags",
                      value: "qui non irure",
                    },
                    {
                      key: "tags",
                      value: "occaecat do est magna",
                    },
                  ],
                },
              },
              status: "Bad Request",
              code: 400,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
      ],
    },
    {
      name: "store",
      item: [
        {
          name: "order",
          item: [
            {
              name: "{order Id}",
              item: [
                {
                  name: "Find purchase order by ID",
                  request: {
                    method: "GET",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/store/order/:orderId",
                      host: ["{{baseUrl}}"],
                      path: ["store", "order", ":orderId"],
                      variable: [
                        {
                          key: "orderId",
                          value: "9",
                          description:
                            "(Required) ID of pet that needs to be fetched",
                        },
                      ],
                    },
                    description:
                      "For valid response try integer IDs with value \u003E= 1 and \u003C= 10. Other values will generated exceptions",
                  },
                  response: [
                    {
                      name: "successful operation",
                      originalRequest: {
                        method: "GET",
                        header: [],
                        url: {
                          raw: "{{baseUrl}}/store/order/:orderId",
                          host: ["{{baseUrl}}"],
                          path: ["store", "order", ":orderId"],
                          variable: [
                            {
                              key: "orderId",
                              value: "9",
                              description:
                                "(Required) ID of pet that needs to be fetched",
                            },
                          ],
                        },
                      },
                      status: "OK",
                      code: 200,
                      _postman_previewlanguage: "Text",
                      header: [
                        {
                          key: "Content-Type",
                          value: "application/json",
                        },
                      ],
                      cookie: [],
                      body: '{\n "id": -89882604,\n "petId": 90146781,\n "quantity": -14654439,\n "shipDate": "1997-08-22T06:35:05.892Z",\n "status": "placed",\n "complete": false\n}',
                    },
                    {
                      name: "Invalid ID supplied",
                      originalRequest: {
                        method: "GET",
                        header: [],
                        url: {
                          raw: "{{baseUrl}}/store/order/:orderId",
                          host: ["{{baseUrl}}"],
                          path: ["store", "order", ":orderId"],
                          variable: [
                            {
                              key: "orderId",
                              value: "9",
                              description:
                                "(Required) ID of pet that needs to be fetched",
                            },
                          ],
                        },
                      },
                      status: "Bad Request",
                      code: 400,
                      _postman_previewlanguage: "Text",
                      header: [
                        {
                          key: "Content-Type",
                          value: "text/plain",
                        },
                      ],
                      cookie: [],
                      body: "",
                    },
                    {
                      name: "Order not found",
                      originalRequest: {
                        method: "GET",
                        header: [],
                        url: {
                          raw: "{{baseUrl}}/store/order/:orderId",
                          host: ["{{baseUrl}}"],
                          path: ["store", "order", ":orderId"],
                          variable: [
                            {
                              key: "orderId",
                              value: "9",
                              description:
                                "(Required) ID of pet that needs to be fetched",
                            },
                          ],
                        },
                      },
                      status: "Not Found",
                      code: 404,
                      _postman_previewlanguage: "Text",
                      header: [
                        {
                          key: "Content-Type",
                          value: "text/plain",
                        },
                      ],
                      cookie: [],
                      body: "",
                    },
                  ],
                },
                {
                  name: "Delete purchase order by ID",
                  request: {
                    method: "DELETE",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/store/order/:orderId",
                      host: ["{{baseUrl}}"],
                      path: ["store", "order", ":orderId"],
                      variable: [
                        {
                          key: "orderId",
                          value: "51096144",
                          description:
                            "(Required) ID of the order that needs to be deleted",
                        },
                      ],
                    },
                    description:
                      "For valid response try integer IDs with positive integer value. Negative or non-integer values will generate API errors",
                  },
                  response: [
                    {
                      name: "Invalid ID supplied",
                      originalRequest: {
                        method: "DELETE",
                        header: [],
                        url: {
                          raw: "{{baseUrl}}/store/order/:orderId",
                          host: ["{{baseUrl}}"],
                          path: ["store", "order", ":orderId"],
                          variable: [
                            {
                              key: "orderId",
                              value: "51096144",
                              description:
                                "(Required) ID of the order that needs to be deleted",
                            },
                          ],
                        },
                      },
                      status: "Bad Request",
                      code: 400,
                      _postman_previewlanguage: "Text",
                      header: [
                        {
                          key: "Content-Type",
                          value: "text/plain",
                        },
                      ],
                      cookie: [],
                      body: "",
                    },
                    {
                      name: "Order not found",
                      originalRequest: {
                        method: "DELETE",
                        header: [],
                        url: {
                          raw: "{{baseUrl}}/store/order/:orderId",
                          host: ["{{baseUrl}}"],
                          path: ["store", "order", ":orderId"],
                          variable: [
                            {
                              key: "orderId",
                              value: "51096144",
                              description:
                                "(Required) ID of the order that needs to be deleted",
                            },
                          ],
                        },
                      },
                      status: "Not Found",
                      code: 404,
                      _postman_previewlanguage: "Text",
                      header: [
                        {
                          key: "Content-Type",
                          value: "text/plain",
                        },
                      ],
                      cookie: [],
                      body: "",
                    },
                  ],
                },
              ],
            },
            {
              name: "Place an order for a pet",
              request: {
                method: "POST",
                header: [
                  {
                    key: "Content-Type",
                    value: "application/json",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "id": -89882604,\n    "petId": 90146781,\n    "quantity": -14654439,\n    "shipDate": "1997-08-22T06:35:05.892Z",\n    "status": "placed",\n    "complete": false\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/store/order",
                  host: ["{{baseUrl}}"],
                  path: ["store", "order"],
                },
              },
              response: [
                {
                  name: "successful operation",
                  originalRequest: {
                    method: "POST",
                    header: [],
                    body: {
                      mode: "raw",
                      raw: '{\n    "id": -89882604,\n    "petId": 90146781,\n    "quantity": -14654439,\n    "shipDate": "1997-08-22T06:35:05.892Z",\n    "status": "placed",\n    "complete": false\n}',
                      options: {
                        raw: {
                          language: "json",
                        },
                      },
                    },
                    url: {
                      raw: "{{baseUrl}}/store/order",
                      host: ["{{baseUrl}}"],
                      path: ["store", "order"],
                    },
                  },
                  status: "OK",
                  code: 200,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "application/json",
                    },
                  ],
                  cookie: [],
                  body: '{\n "id": -89882604,\n "petId": 90146781,\n "quantity": -14654439,\n "shipDate": "1997-08-22T06:35:05.892Z",\n "status": "placed",\n "complete": false\n}',
                },
                {
                  name: "Invalid Order",
                  originalRequest: {
                    method: "POST",
                    header: [],
                    body: {
                      mode: "raw",
                      raw: '{\n    "id": -89882604,\n    "petId": 90146781,\n    "quantity": -14654439,\n    "shipDate": "1997-08-22T06:35:05.892Z",\n    "status": "placed",\n    "complete": false\n}',
                      options: {
                        raw: {
                          language: "json",
                        },
                      },
                    },
                    url: {
                      raw: "{{baseUrl}}/store/order",
                      host: ["{{baseUrl}}"],
                      path: ["store", "order"],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
          ],
        },
        {
          name: "Returns pet inventories by status",
          request: {
            auth: {
              type: "apikey",
              apikey: [
                {
                  key: "key",
                  value: "api_key",
                  type: "string",
                },
                {
                  key: "value",
                  value: "\u003CAPI Key\u003E",
                  type: "string",
                },
                {
                  key: "in",
                  value: "header",
                  type: "string",
                },
              ],
            },
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/store/inventory",
              host: ["{{baseUrl}}"],
              path: ["store", "inventory"],
            },
            description: "Returns a map of status codes to quantities",
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "GET",
                header: [
                  {
                    key: "api_key",
                    value: "\u003CAPI Key\u003E",
                    description: "Added as a part of security scheme: apikey",
                  },
                ],
                url: {
                  raw: "{{baseUrl}}/store/inventory",
                  host: ["{{baseUrl}}"],
                  path: ["store", "inventory"],
                },
              },
              status: "OK",
              code: 200,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              cookie: [],
              body: "{}",
            },
          ],
        },
      ],
    },
    {
      name: "user",
      item: [
        {
          name: "{username}",
          item: [
            {
              name: "Get user by user name",
              request: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/user/:username",
                  host: ["{{baseUrl}}"],
                  path: ["user", ":username"],
                  variable: [
                    {
                      key: "username",
                      value: "et c",
                      description:
                        "(Required) The name that needs to be fetched. Use user1 for testing. ",
                    },
                  ],
                },
              },
              response: [
                {
                  name: "successful operation",
                  originalRequest: {
                    method: "GET",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) The name that needs to be fetched. Use user1 for testing. ",
                        },
                      ],
                    },
                  },
                  status: "OK",
                  code: 200,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "application/json",
                    },
                  ],
                  cookie: [],
                  body: '{\n "id": -98504191,\n "username": "in sint exercitation sed",\n "firstName": "sunt sed eu do laboris",\n "lastName": "sint",\n "email": "veniam aliquip fugiat in",\n "password": "voluptate nostrud",\n "phone": "pariatur esse minim occaecat mollit",\n "userStatus": 99977876\n}',
                },
                {
                  name: "Invalid username supplied",
                  originalRequest: {
                    method: "GET",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) The name that needs to be fetched. Use user1 for testing. ",
                        },
                      ],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
                {
                  name: "User not found",
                  originalRequest: {
                    method: "GET",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) The name that needs to be fetched. Use user1 for testing. ",
                        },
                      ],
                    },
                  },
                  status: "Not Found",
                  code: 404,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
            {
              name: "Updated user",
              request: {
                method: "PUT",
                header: [
                  {
                    key: "Content-Type",
                    value: "application/json",
                  },
                ],
                body: {
                  mode: "raw",
                  raw: '{\n    "id": -98504191,\n    "username": "in sint exercitation sed",\n    "firstName": "sunt sed eu do laboris",\n    "lastName": "sint",\n    "email": "veniam aliquip fugiat in",\n    "password": "voluptate nostrud",\n    "phone": "pariatur esse minim occaecat mollit",\n    "userStatus": 99977876\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/user/:username",
                  host: ["{{baseUrl}}"],
                  path: ["user", ":username"],
                  variable: [
                    {
                      key: "username",
                      value: "et c",
                      description: "(Required) name that need to be updated",
                    },
                  ],
                },
                description: "This can only be done by the logged in user.",
              },
              response: [
                {
                  name: "Invalid user supplied",
                  originalRequest: {
                    method: "PUT",
                    header: [],
                    body: {
                      mode: "raw",
                      raw: '{\n    "id": -98504191,\n    "username": "in sint exercitation sed",\n    "firstName": "sunt sed eu do laboris",\n    "lastName": "sint",\n    "email": "veniam aliquip fugiat in",\n    "password": "voluptate nostrud",\n    "phone": "pariatur esse minim occaecat mollit",\n    "userStatus": 99977876\n}',
                      options: {
                        raw: {
                          language: "json",
                        },
                      },
                    },
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) name that need to be updated",
                        },
                      ],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
                {
                  name: "User not found",
                  originalRequest: {
                    method: "PUT",
                    header: [],
                    body: {
                      mode: "raw",
                      raw: '{\n    "id": -98504191,\n    "username": "in sint exercitation sed",\n    "firstName": "sunt sed eu do laboris",\n    "lastName": "sint",\n    "email": "veniam aliquip fugiat in",\n    "password": "voluptate nostrud",\n    "phone": "pariatur esse minim occaecat mollit",\n    "userStatus": 99977876\n}',
                      options: {
                        raw: {
                          language: "json",
                        },
                      },
                    },
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) name that need to be updated",
                        },
                      ],
                    },
                  },
                  status: "Not Found",
                  code: 404,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
            {
              name: "Delete user",
              request: {
                method: "DELETE",
                header: [],
                url: {
                  raw: "{{baseUrl}}/user/:username",
                  host: ["{{baseUrl}}"],
                  path: ["user", ":username"],
                  variable: [
                    {
                      key: "username",
                      value: "et c",
                      description:
                        "(Required) The name that needs to be deleted",
                    },
                  ],
                },
                description: "This can only be done by the logged in user.",
              },
              response: [
                {
                  name: "Invalid username supplied",
                  originalRequest: {
                    method: "DELETE",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) The name that needs to be deleted",
                        },
                      ],
                    },
                  },
                  status: "Bad Request",
                  code: 400,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
                {
                  name: "User not found",
                  originalRequest: {
                    method: "DELETE",
                    header: [],
                    url: {
                      raw: "{{baseUrl}}/user/:username",
                      host: ["{{baseUrl}}"],
                      path: ["user", ":username"],
                      variable: [
                        {
                          key: "username",
                          value: "et c",
                          description:
                            "(Required) The name that needs to be deleted",
                        },
                      ],
                    },
                  },
                  status: "Not Found",
                  code: 404,
                  _postman_previewlanguage: "Text",
                  header: [
                    {
                      key: "Content-Type",
                      value: "text/plain",
                    },
                  ],
                  cookie: [],
                  body: "",
                },
              ],
            },
          ],
        },
        {
          name: "Create user",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: '{\n    "id": -98504191,\n    "username": "in sint exercitation sed",\n    "firstName": "sunt sed eu do laboris",\n    "lastName": "sint",\n    "email": "veniam aliquip fugiat in",\n    "password": "voluptate nostrud",\n    "phone": "pariatur esse minim occaecat mollit",\n    "userStatus": 99977876\n}',
              options: {
                raw: {
                  language: "json",
                },
              },
            },
            url: {
              raw: "{{baseUrl}}/user",
              host: ["{{baseUrl}}"],
              path: ["user"],
            },
            description: "This can only be done by the logged in user.",
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "POST",
                header: [],
                body: {
                  mode: "raw",
                  raw: '{\n    "id": -98504191,\n    "username": "in sint exercitation sed",\n    "firstName": "sunt sed eu do laboris",\n    "lastName": "sint",\n    "email": "veniam aliquip fugiat in",\n    "password": "voluptate nostrud",\n    "phone": "pariatur esse minim occaecat mollit",\n    "userStatus": 99977876\n}',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/user",
                  host: ["{{baseUrl}}"],
                  path: ["user"],
                },
              },
              status: "Internal Server Error",
              code: 500,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Creates list of users with given input array",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: '[\n    {\n        "id": -35371498,\n        "username": "laborum enim ullamco incididunt",\n        "firstName": "Ut ipsum est ut",\n        "lastName": "tempor ut do",\n        "email": "labore incididunt dolore veniam",\n        "password": "sunt Ut",\n        "phone": "eu",\n        "userStatus": -12729823\n    },\n    {\n        "id": -67078303,\n        "username": "exercitation laborum mollit",\n        "firstName": "magna ea quis",\n        "lastName": "id enim ut",\n        "email": "cillu",\n        "password": "ex ve",\n        "phone": "id velit aute esse",\n        "userStatus": -82319977\n    }\n]',
              options: {
                raw: {
                  language: "json",
                },
              },
            },
            url: {
              raw: "{{baseUrl}}/user/createWithArray",
              host: ["{{baseUrl}}"],
              path: ["user", "createWithArray"],
            },
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "POST",
                header: [],
                body: {
                  mode: "raw",
                  raw: '[\n    {\n        "id": -59662309,\n        "username": "cillum elit esse",\n        "firstName": "officia in s",\n        "lastName": "Excepteur incididunt anim",\n        "email": "officia",\n        "password": "reprehenderit magna quis",\n        "phone": "Ut aute labore",\n        "userStatus": -70536967\n    },\n    {\n        "id": -65396176,\n        "username": "ullamco non",\n        "firstName": "dolor in occaecat laboru",\n        "lastName": "occaecat anim voluptate tempor Excepteur",\n        "email": "Excepteur",\n        "password": "pariatur in",\n        "phone": "sed in",\n        "userStatus": 34113498\n    }\n]',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/user/createWithArray",
                  host: ["{{baseUrl}}"],
                  path: ["user", "createWithArray"],
                },
              },
              status: "Internal Server Error",
              code: 500,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Creates list of users with given input array",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: '[\n    {\n        "id": -35371498,\n        "username": "laborum enim ullamco incididunt",\n        "firstName": "Ut ipsum est ut",\n        "lastName": "tempor ut do",\n        "email": "labore incididunt dolore veniam",\n        "password": "sunt Ut",\n        "phone": "eu",\n        "userStatus": -12729823\n    },\n    {\n        "id": -67078303,\n        "username": "exercitation laborum mollit",\n        "firstName": "magna ea quis",\n        "lastName": "id enim ut",\n        "email": "cillu",\n        "password": "ex ve",\n        "phone": "id velit aute esse",\n        "userStatus": -82319977\n    }\n]',
              options: {
                raw: {
                  language: "json",
                },
              },
            },
            url: {
              raw: "{{baseUrl}}/user/createWithList",
              host: ["{{baseUrl}}"],
              path: ["user", "createWithList"],
            },
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "POST",
                header: [],
                body: {
                  mode: "raw",
                  raw: '[\n    {\n        "id": -59662309,\n        "username": "cillum elit esse",\n        "firstName": "officia in s",\n        "lastName": "Excepteur incididunt anim",\n        "email": "officia",\n        "password": "reprehenderit magna quis",\n        "phone": "Ut aute labore",\n        "userStatus": -70536967\n    },\n    {\n        "id": -65396176,\n        "username": "ullamco non",\n        "firstName": "dolor in occaecat laboru",\n        "lastName": "occaecat anim voluptate tempor Excepteur",\n        "email": "Excepteur",\n        "password": "pariatur in",\n        "phone": "sed in",\n        "userStatus": 34113498\n    }\n]',
                  options: {
                    raw: {
                      language: "json",
                    },
                  },
                },
                url: {
                  raw: "{{baseUrl}}/user/createWithList",
                  host: ["{{baseUrl}}"],
                  path: ["user", "createWithList"],
                },
              },
              status: "Internal Server Error",
              code: 500,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Logs user into the system",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/user/login?username=et c&password=et c",
              host: ["{{baseUrl}}"],
              path: ["user", "login"],
              query: [
                {
                  key: "username",
                  value: "et c",
                  description: "(Required) The user name for login",
                },
                {
                  key: "password",
                  value: "et c",
                  description:
                    "(Required) The password for login in clear text",
                },
              ],
            },
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/user/login?username=et c&password=et c",
                  host: ["{{baseUrl}}"],
                  path: ["user", "login"],
                  query: [
                    {
                      key: "username",
                      value: "et c",
                    },
                    {
                      key: "password",
                      value: "et c",
                    },
                  ],
                },
              },
              status: "OK",
              code: 200,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "X-Rate-Limit",
                  value: "78435736",
                  description: {
                    content: "calls per hour allowed by the user",
                    type: "text/plain",
                  },
                },
                {
                  key: "X-Expires-After",
                  value: "1971-10-09T07:26:48.019Z",
                  description: {
                    content: "date in UTC when token expires",
                    type: "text/plain",
                  },
                },
                {
                  key: "Content-Type",
                  value: "application/json",
                },
              ],
              cookie: [],
              body: '"et c"',
            },
            {
              name: "Invalid username/password supplied",
              originalRequest: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/user/login?username=et c&password=et c",
                  host: ["{{baseUrl}}"],
                  path: ["user", "login"],
                  query: [
                    {
                      key: "username",
                      value: "et c",
                    },
                    {
                      key: "password",
                      value: "et c",
                    },
                  ],
                },
              },
              status: "Bad Request",
              code: 400,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
        {
          name: "Logs out current logged in user session",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/user/logout",
              host: ["{{baseUrl}}"],
              path: ["user", "logout"],
            },
          },
          response: [
            {
              name: "successful operation",
              originalRequest: {
                method: "GET",
                header: [],
                url: {
                  raw: "{{baseUrl}}/user/logout",
                  host: ["{{baseUrl}}"],
                  path: ["user", "logout"],
                },
              },
              status: "Internal Server Error",
              code: 500,
              _postman_previewlanguage: "Text",
              header: [
                {
                  key: "Content-Type",
                  value: "text/plain",
                },
              ],
              cookie: [],
              body: "",
            },
          ],
        },
      ],
    },
  ],
  variable: [
    {
      key: "baseUrl",
      value: "https://petstore.swagger.io/v2",
      type: "string",
    },
  ],
};
