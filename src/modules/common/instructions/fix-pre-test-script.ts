export const fixPreTestScriptInstructions = `
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
                  },
                  test: (name: string, fn: Function) => {
                    try {
                      fn();
                    } catch (err: any) {
                    }
                  },
                  environment:{
                    set:(key: any, value: any)=>{
                    },
                    get:(key: any)=>{
                    },
                  },
                  global:{
                    set:(key: any, value: any)=>{
                    },
                    get:(key: any)=>{
                    }
                  },
                  xmlToJSON: (xml: string) => {
                    const json = {};
                    // Convert XML to JSON logic here
                    return json;
                  },
                  uuid: () => {
                  },
                  expect,
                };

                - Fix testcases using above syntax, 
                - Ensure all test cases are valid syntactically,
                - Dont use any other syntax or return any other text outside of the test cases.
                - Dont use any markdown or code snippet
                - Do not wrap the output in markdown, code fences, or labels (e.g., "javascript", "Here are...", etc.).
                - The model should return only raw JavaScript test cases in the correct syntax.
                - Unnecessary text like "Here are the corrected test cases:" are not required, its breaking the js syntax.
                - Dont give any introduction or ending phrase just give only the testcase.
                - Example format:  '
                    sp.test("userId is a number", function () {
                      sp.expect(jsonBody.userId).to.be.a("number");
                    });
                '
      `;