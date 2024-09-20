// @ts-nocheck
export const postmanMock = {
  info: {
    _postman_id: "6b317593-8ec0-4c5a-95af-fa02795ae03e",
    name: "Test Collection",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    _exporter_id: "36562499",
  },
  item: [
    {
      name: "Form Data Request",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "formdata",
          formdata: [
            {
              key: "key1",
              value: "value1",
              type: "text",
            },
            {
              key: "key2",
              type: "file",
              src: "/Users/nayan/Downloads/avb2gydlq.webp",
            },
          ],
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "x-www request",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "urlencoded",
          urlencoded: [
            {
              key: "key1",
              value: "value1",
              type: "text",
            },
            {
              key: "key2",
              value: "value2",
              type: "text",
            },
          ],
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "raw - json",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "raw",
          raw: '{\n    "key1": "value1",\n    "key2": 2\n}',
          options: {
            raw: {
              language: "json",
            },
          },
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "raw - html",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "raw",
          raw: '\u003C!DOCTYPE html\u003E\n\u003Chtml\u003E\n  \u003Cbody\u003E\n    \u003Cform action="/submit" method="POST"\u003E\n      \u003Clabel for="name"\u003EName:\u003C/label\u003E\n      \u003Cinput type="text" id="name" name="name"\u003E\u003Cbr\u003E\u003Cbr\u003E\n      \u003Clabel for="email"\u003EEmail:\u003C/label\u003E\n      \u003Cinput type="email" id="email" name="email"\u003E\u003Cbr\u003E\u003Cbr\u003E\n      \u003Cinput type="submit" value="Submit"\u003E\n    \u003C/form\u003E\n  \u003C/body\u003E\n\u003C/html\u003E',
          options: {
            raw: {
              language: "html",
            },
          },
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "raw - xml",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "raw",
          raw: '\u003C?xml version="1.0" encoding="UTF-8"?\u003E\n\u003Crequest\u003E\n    \u003Cname\u003EJohn Doe\u003C/name\u003E\n    \u003Cemail\u003Ejohn.doe@example.com\u003C/email\u003E\n\u003C/request\u003E',
          options: {
            raw: {
              language: "xml",
            },
          },
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "raw - text",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "raw",
          raw: "A simple plain text",
          options: {
            raw: {
              language: "text",
            },
          },
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
    {
      name: "raw - js",
      protocolProfileBehavior: {
        disableBodyPruning: true,
      },
      request: {
        method: "GET",
        header: [],
        body: {
          mode: "raw",
          raw: "let a = 10;",
          options: {
            raw: {
              language: "javascript",
            },
          },
        },
        url: {
          raw: "www.google.com",
          host: ["www", "google", "com"],
        },
      },
      response: [],
    },
  ],
};
