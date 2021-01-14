import axios from "axios";
import qs from "qs";
import requestConfig from "@/config/request";
import { isAttrs, debounce } from "@/utils/index.js";
import { loading, toast, dialog } from "@/plugins/modal/index.js";
import { getStorages, removeStorages } from "@/plugins/storages/index.js";
import {
  mapRequest as MapRequest,
  fileToFormData,
  requestAdapter,
} from "./utils";

if (requestAdapter) {
  axios.defaults.adapter = requestAdapter; //请求适配器
}

axios.defaults.headers["Content-Type"] = "application/json;charset=utf-8";

const service = axios.create({
  baseURL: requestConfig.baseUrl,
  timeout: requestConfig.timeout,
});

const statusCode = {
  200: "服务器成功返回请求的数据。",
  201: "新建或修改数据成功。",
  202: "一个请求已经进入后台排队（异步任务）。",
  204: "删除数据成功。",
  400: "发出的请求有错误，服务器没有进行新建或修改数据的操作。",
  401: "认证失败，无法访问系统资源",
  403: "请重新登录",
  404: "访问资源不存在",
  406: "请求的格式不可得。",
  410: "请求的资源被永久删除，且不会再得到的。",
  422: "当创建一个对象时，发生一个验证错误。",
  500: "服务器发生错误，请检查服务器。",
  502: "网关错误。",
  503: "服务不可用，服务器暂时过载或维护。",
  504: "网关超时。",
  default: "系统未知错误，请反馈给管理员",
};

// 请求拦截
service.interceptors.request.use(
  (request) => {
    const {
      baseURL,
      url,
      data,
      params,
      isToken,
      isUpload,
      isLoading,
    } = request;
    console.log(
      `请求拦截: url: ${baseURL + url}, data: ${JSON.stringify(
        data
      )}, params: ${JSON.stringify(params)}`
    );

    //解决query无法传递数组的问题
    request.paramsSerializer = (params) =>
      qs.stringify(params, { arrayFormat: "repeat" });

    if (isToken) {
      request.headers[requestConfig.authorization.key] =
        requestConfig.authorization.prefix + getStorages("token");
    }

    if (isLoading) {
      loading("请稍后...");
    }

    if (isUpload) {
      request.headers["Content-Type"] = "multipart/form-data;";
      request.data = fileToFormData(request.data);
    }

    return request;
  },
  (error) => {
    console.log(error);
    Promise.reject(error);
  }
);

const clearLoading = debounce(loading); //清除定时器
const goLogin = debounce(async (callback) => {
  const result = await dialog("该服务需要进行登录后才能正常使用,是否登录?", {
    isCancel: true,
  });
  if (result) {
    callback();
  }
});
// 响应拦截
service.interceptors.response.use(
  async (response) => {
    console.log("response", response);
    const {
      data,
      config: { isLoading, isIntercept, baseURL, url },
    } = response;

    // const { code, message: msg } = data;
    const { code, msg } = data;

    console.log(
      `响应拦截: url: ${baseURL + url}, data: ${JSON.stringify(data)}`
    );

    if (isLoading) {
      clearLoading();
    }

    if (!isIntercept) {
      return data;
    }

    const message = statusCode[code] || msg || statusCode["default"];

    switch (code) {
      case 401:
        removeStorages("token");
        goLogin();
        break;
      case 403:
        removeStorages("token");
        goLogin();
        break;
      case 500:
        toast(message);
        break;

      default:
        if (code === requestConfig.responseSuccessCode || code === 200) {
          return data;
        } else {
          return Promise.reject("error");
        }
    }
  },
  (error) => {
    console.log("err:" + error);
    return Promise.reject(error);
  }
);

/**
 *
 * @param {string} url
 * @param {object} params
 * @param {object} options isBody 是否body方式传参 isToken 是否传token isLoading是否显示loading  isIntercept是否自动控制状态 moreOptions更多选项
 */
export function request(
  url = "",
  params = {},
  {
    method = "post",
    isBody = true,
    isToken = true,
    isLoading = true,
    isIntercept = true,
    isUpload = false,
    ...moreOptions
  } = {}
) {
  if (isUpload) {
    isBody = true;
    method = "post";
  }

  const way = isBody ? "data" : "params";

  let data = formatData(params, way);
  function formatData(params, way) {
    let tempObj = {
      data: {},
      params: {},
    };

    if (isAttrs(params, "body")) {
      tempObj.data = params.body;
    }

    if (isAttrs(params, "query")) {
      tempObj.params = params.query;
    }

    if (!isAttrs(params, "body") && !isAttrs(params, "query")) {
      tempObj[way] = params;
    }
    return tempObj;
  }

  return service({
    url,
    method,
    ...data,

    isToken,
    isLoading,
    isIntercept,
    isUpload,
    ...moreOptions,
  });
}

//请求辅助函数
export function mapRequest(arr, { ...moreOptions } = {}) {
  return MapRequest(arr, { ...moreOptions, request });
}

export default {
  install(app) {
    app.config.globalProperties.$req = request;
  },
  request,
};