export const generateTestCasesInstructions = `
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
                  response: {
                    statusCode: number ,
                    body: {
                      text: () => {
                        try {
                          return string;
                        } catch {
                          return {};
                        }
                      },  
                      json: () => {
                        try {
                          return JSON.parse(string);
                        } catch {
                          return {};
                        }
                      },  
                    },
                    headers: object,
                    size: number,
                    time: number,
                  },
                  test: (name: string, fn: Function) => {
                    try {
                      fn();
                    } catch (err: any) {
                    }
                  },
                  expect,
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
