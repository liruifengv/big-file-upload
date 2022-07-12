import axios from 'axios'
import AxiosError from 'axios/lib/core/AxiosError'
import qs from 'qs'

const instance = axios.create()
/**
 * 是否是开发模式
 */
const isDev = process.env.NODE_ENV === 'development'

/**
 * 是否是 IE 浏览器
 */
const isIE = Boolean(window.ActiveXObject) || 'ActiveXObject' in window

/**
 * 是否是 V5 风格的后端接口
 */
const isV5Style = response => /^\/v5\//.test(response.config.url)

/**
 * 重新登录场景下，是否跳过后续多余的错误消息显示
 *  1 一直显示消息
 *  0 显示一次消息，后续不再显示
 * -1 不显示消息
 */
let skipShowTips = 1

export function getCancelTokenSource() {
  return instance.CancelToken.source()
}

/**
 * 生成 axios request config 对象
 * axios 完整 config 对象配置参考官方文档：https://github.com/axios/axios#request-config
 *
 * paramsStyle 和 formDataStyle 的参数设置
 * 参考 qs.stringify 中 arrayFormat 的说明：https://github.com/ljharb/qs
 *   brackets: 'a[]=b&a[]=c'
 *    indices: 'a[0]=b&a[1]=c'
 *     repeat: 'a=b&a=c'
 *      comma: 'a=b,c'
 */
export function request(config) {
  const {
    paramsStyle,
    formData,
    formDataStyle = 'indices',
    fulfillOnError = false,
    loginOnSessionExpired = true,
    tipsOnError = true,
    ...axiosConfig
  } = config

  // 清除 IE 浏览器对 ajax get 请求的缓存
  // 详见 https://api.jquery.com/jquery.ajax/ 中关于 cache 参数的说明
  if (isIE && (!axiosConfig.method || axiosConfig.method.toLowerCase() === 'get')) {
    axiosConfig.params = { ...axiosConfig.params, _: new Date().getTime() }
  }

  // 通过 qs.stringify 处理 params 数据格式
  if (paramsStyle) {
    axiosConfig.paramsSerializer = params => qs.stringify(params, { arrayFormat: paramsStyle })
  }

  // 通过 qs.stringify 处理 urlencoded form 数据格式
  if (formData) {
    if (isDev && axiosConfig.data) {
      // eslint-disable-next-line no-console
      console.warn('[request] formData 与 data 同时设置时，data 将被 formData 覆盖')
    }
    axiosConfig.data = qs.stringify(formData, { arrayFormat: formDataStyle })
  }

  let p = instance.request(axiosConfig)

  // 格式化返回值为标准格式
  p = p.then(
    response =>
      Promise.resolve({
        style: 'default',
        error: null,
        response,
        code: response.status,
        data: response.data,
        message: response.data.message || response.data.msg,
      }),
    error =>
      Promise.reject({
        style: 'default',
        error,
        response: error.response,
        code: error.response.status,
        data: error.response.data,
        message: error.response.data.message || error.response.data.msg,
      })
  )

  // 处理V5接口，业务错误的场景，转向failed流程
  p = p.then(result => {
    const { response } = result

    if (!isV5Style(response)) {
      return Promise.resolve(result)
    }
    if (response.data.code === '200') {
      return Promise.resolve({
        ...result,
        style: 'v5',
        code: Number(response.data.code),
        data: response.data.data,
        message: response.data.message || response.data.msg,
      })
    }

    return Promise.reject({
      ...result,
      style: 'v5',
      error: AxiosError(response.data.msg, Number(response.data.code),response.config, null, response.request, response),
      code: Number(response.data.code),
      data: response.data.data,
      message: response.data.message || response.data.msg,
    })
  })

  // 指定特殊的错误码，以 fulfill 流程返回
  p = p.catch(result => {
    if (fulfillOnError === true) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn(
          '[request] 一般情况下，不要设置 fulfillOnError 为 true。请设置为具体错误码，例：fulfillOnError: 403, fulfillOnError: [401, 10004]'
        )
      }
      return Promise.resolve({
        ...result,
        fulfillOnError,
      })
    }

    if (fulfillOnError !== false) {
      let errorList = Array.isArray(fulfillOnError) ? fulfillOnError : [fulfillOnError]
      errorList = errorList.map(Number)
      if (errorList.indexOf(result.code) > -1) {
        return Promise.resolve({
          ...result,
          fulfillOnError,
        })
      }
    }

    return Promise.reject(result)
  })

  // 身份认证过期，重新登录处理
  p = p.catch(result => {
    const { code, style } = result
    if (
      loginOnSessionExpired &&
      skipShowTips >= 1 &&
      (code === 401 || (style === 'v5' && code === 10004))
    ) {
      skipShowTips = 0
      window.location = window.location.pathname + '#/login'
    }

    return Promise.reject(result)
  })

  // failed 流程，显示错误消息提示处理
  p = p.catch(result => {
    const { code, message, style } = result
    if (tipsOnError && skipShowTips >= 0) {
      if (skipShowTips === 0) {
        skipShowTips = -1
      }
      console.log('code:', code)
    }

    return Promise.reject(result)
  })

  return p
}
