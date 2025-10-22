export const generatePreScriptInstructions = `
           const expect = (actual: any) => ({
              to: {
                equal: (expected: any) => {

                },
                notEqual: (expected: any) => {
                },
                exist: () => {
                
                },
                notExist: () => {
                
                },
                be: {
                  a: (type: string) => {
                  },
                  true: () => {
                  },
                  false: () => {
                
                  
                  },
                  within: (min: number, max: number) => {
                
                  },
                  lessThan: (expected: number) => {
                  },
                  greaterThan: (expected: number) => {

                  },
                  empty: () => {
                
                  },
                  notEmpty: () => {
                  
                  },
                },
                contain: (expected: any) => {
                  
                },
                notContain: (expected: any) => {
                
                },
                beInList: (list: any[]) => {
              
                },
                notBeInList: (list: any[]) => {
                
                },
                have: {
                  all: {
                    keys: (...keys: string[]) => {
                  
                    },
                  },
                },
              },
            });

            const sp = {
                request: {
                  body: {
                   raw:{
                    text: () => {
                      // Returns the raw body text as string
                    },
                    json: () => {
                      // Parses and returns the raw body as JSON object
                    },
                    set: (data: string) => {
                      // Sets the raw body data
                    },
                   },
                   formdata:{
                    text: () => {
                      // Returns form data as JSON string
                    },
                    json: () => {
                      // Returns form data as JSON object
                    },
                    set: (key: any, value: any) => {
                      // Sets or updates a form data key-value pair
                    },
                    get: (key: any) => {
                      // Gets the value of a form data key
                    },
                    remove: (key: any) => {
                      // Removes a form data key-value pair
                    },
                    clear: () => {
                      // Clears all form data
                    },
                    has: (key: any) => {
                      // Checks if form data contains a specific key
                    },
                    enable: (key: any) => {
                      // Enables/checks a form data field
                    },
                    disable: (key: any) => {
                      // Disables/unchecks a form data field
                    },
                    isChecked: (key: any) => {
                      // Checks if a form data field is enabled/checked
                    },
                   },
                   urlencoded: {
                    text: () => {
                      // Returns URL encoded data as JSON string
                    },
                    json: () => {
                      // Returns URL encoded data as JSON object
                    },
                    set: (key: any, value: any) => {
                      // Sets or updates a URL encoded key-value pair
                    },
                    get: (key: any) => {
                      // Gets the value of a URL encoded key
                    },
                    remove: (key: any) => {
                      // Removes a URL encoded key-value pair
                    },
                    clear: () => {
                      // Clears all URL encoded data
                    },
                    has: (key: any) => {
                      // Checks if URL encoded data contains a specific key
                    },
                    enable: (key: any) => {
                      // Enables/checks a URL encoded field
                    },
                    disable: (key: any) => {
                      // Disables/unchecks a URL encoded field
                    },
                    isChecked: (key: any) => {
                      // Checks if a URL encoded field is enabled/checked
                    }
                   }
                  },
                  url: {
                    text: () => {
                      // Returns the complete request URL
                    },
                    set: (newUrl: any) => {
                      // Sets a new URL for the request
                    },
                    getBaseUrl: () => {
                      // Gets the base URL (protocol + host) from the request URL
                    },
                    getPath: () => {
                      // Gets the path portion from the request URL
                    },
                  },
                  headers: {
                    text: () => {
                      // Returns headers as JSON string
                    },
                    json: () => {
                      // Returns headers as JSON object
                    },
                    set: (key: any, value: any) => {
                      // Sets or updates a header key-value pair
                    },
                    get: (key: any) => {
                      // Gets the value of a header by key
                    },
                    remove: (key: any) => {
                      // Removes a header by key
                    },
                    clear: () => {
                      // Clears all headers
                    },
                    has: (key: any) => {
                      // Checks if a header exists by key
                    },
                    enable: (key: any) => {
                      // Enables/checks a header
                    },
                    disable: (key: any) => {
                      // Disables/unchecks a header
                    },
                    isChecked: (key: any) => {
                      // Checks if a header is enabled/checked
                    },
                  },
                  parameters: {
                    text: () => {
                      // Returns query parameters as JSON string
                    },
                    json: () => {
                      // Returns query parameters as JSON object
                    },
                    set: (key: any, value: any) => {
                      // Sets or updates a query parameter key-value pair
                    },
                    get: (key: any) => {
                      // Gets the value of a query parameter by key
                    },
                    remove: (key: any) => {
                      // Removes a query parameter by key
                    },
                    clear: () => {
                      // Clears all query parameters
                    },
                    has: (key: any) => {
                      // Checks if a query parameter exists by key
                    },
                    enable: (key: any) => {
                      // Enables/checks a query parameter
                    },
                    disable: (key: any) => {
                      // Disables/unchecks a query parameter
                    },
                    isChecked: (key: any) => {
                      // Checks if a query parameter is enabled/checked
                    },

                  },

                  method: {
                    text: () => {
                      // Returns the current HTTP method
                    },
                    set: (newMethod: any) => {
                      // Sets the HTTP method for the request
                    },
                  },
                  auth:{
                    bearerToken : {
                      text: () => {
                        // Returns the bearer token
                      },
                      set: (token: any) => {
                        // Sets the bearer token for authentication
                      },
                      clear: () => {
                        // Clears the bearer token
                      },
                    },
                    basicAuth:{
                      username:{
                        text: () => {
                          // Returns the basic auth username
                        },
                        set: (username: any) => {
                          // Sets the basic auth username
                        },
                      },
                      password:{
                        text: () => {
                          // Returns the basic auth password
                        },
                        set: (password: any) => {
                          // Sets the basic auth password
                        },
                      },
                      set: (username: any, password: any) => {
                        // Sets both username and password for basic auth
                      },
                      clear: () => {
                        // Clears basic auth credentials
                      },
                    },
                    apiKey:{
                      key:{
                        text: () => {
                          // Returns the API key name/identifier
                        },
                        set: (key: any) => {
                          // Sets the API key name/identifier
                        },
                      },
                      value:{
                        text: () => {
                          // Returns the API key value
                        },
                        set: (value: any) => {
                          // Sets the API key value
                        },
                      },
                      set: (key: any, value: any) => {
                        // Sets both API key name and value
                      },
                      clear: () => {
                        // Clears API key credentials
                      },
                    },
                    clear: () => {
                      // Clears all authentication data
                    }
                  }
                },
                test: (name: any, fn: any) => {
                  // Executes a test case with the given name and function
                },
                environment:{
                  set:(key: any, value: any)=>{
                    // Sets an environment variable
                  },
                  get:(key: any)=>{
                    // Gets an environment variable value
                  }
                },

                global:{
                  set:(key: any, value: any)=>{
                    // Sets a global variable
                  },
                  get:(key: any)=>{
                    // Gets a global variable value
                  }
                },
                uuid: () => {
                  // Generates a random UUID string
                },
                xmlToJSON: (xml: any) => {
                  // Converts XML string to JSON object
                },
                expect
              };

                - create testcases using above syntax, 
                - ensure all test cases are valid syntactically,
                - dont use any other syntax or return any other text outside of the test cases.
                - dont use any markdown or code snippet
                - dont wrap output in triple backticks or labels like "javascript", "js", etc.
                - Output must be ONLY the raw test cases in javascript format.
                - if user prompt is not valid then return 
                - Example format:  '
                    sp.test("userId is a number", function () {
                      sp.expect(jsonBody.userId).to.be.a("number");
                    });
                '
      `;
