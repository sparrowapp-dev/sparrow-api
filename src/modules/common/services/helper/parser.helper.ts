export function resolveAllRefs(spec: any) {
  if (!spec) return spec;

  if (typeof spec === "object") {
    const componentToResolve = spec.components ?? spec.definitions;
    const resolvedSpec: { [key: string]: any } = {};
    for (const key in spec) {
      if (componentToResolve.schemas) {
        resolvedSpec[key] = resolveComponentRef(
          spec[key],
          componentToResolve,
          [],
        );
      } else {
        resolvedSpec[key] = resolveDefinitionRef(spec[key], componentToResolve);
      }
    }
    return resolvedSpec;
  }

  return spec;
}

function resolveComponentRef(data: any, components: any, cache: any): any {
  if (!data) return data;

  if (typeof data === "object") {
    if (data.hasOwnProperty("$ref") && typeof data["$ref"] === "string") {
      const refPath = data["$ref"];
      if (refPath.startsWith("#/components/schemas/")) {
        const schemaName = refPath.split("/").pop();
        if (
          components &&
          components.schemas &&
          components.schemas[schemaName]
        ) {
          if (cache.indexOf(schemaName) !== -1) {
            // Circular reference found, replace with undefined
            return undefined;
          }
          cache.push(schemaName);
          return resolveComponentRef(
            components.schemas[schemaName],
            components,
            cache,
          );
        } else {
          console.warn(`Reference "${refPath}" not found in components`);
          return data;
        }
      } else {
        return data;
      }
    } else {
      const newData: { [key: string]: any } = {};
      for (const key in data) {
        newData[key] = resolveComponentRef(data[key], components, cache);
      }
      return newData;
    }
  }

  return data;
}

function resolveDefinitionRef(data: any, definitions: any): any {
  if (!data) return data;

  if (typeof data === "object") {
    if (data.hasOwnProperty("$ref") && typeof data["$ref"] === "string") {
      const refPath = data["$ref"];
      if (refPath.startsWith("#/definitions/")) {
        const schemaName = refPath.split("/").pop();
        if (definitions && definitions[schemaName]) {
          return resolveDefinitionRef(definitions[schemaName], definitions);
        } else {
          console.warn(`Reference "${refPath}" not found in definitions`);
          return data;
        }
      } else {
        return data;
      }
    } else {
      const newData: { [key: string]: any } = {};
      for (const key in data) {
        newData[key] = resolveDefinitionRef(data[key], definitions);
      }
      return newData;
    }
  }

  return data;
}
