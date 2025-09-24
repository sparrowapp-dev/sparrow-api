import type { HttpClientResponseInterface } from "@src/types/http-client";

export const success = <T>(data: T): HttpClientResponseInterface<T> => {
  return {
    status: "success",
    isSuccessful: true,
    message: "",
    data,
  };
};

export const error = <T>(
  error: string,
  data?: T,
  tabId: string = "",
): HttpClientResponseInterface<T> => {
  return {
    status: "error",
    isSuccessful: false,
    message: error,
    data,
  };
};
