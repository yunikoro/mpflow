import { getOptions, stringifyRequest } from 'loader-utils'
import qs from 'querystring'
import { externalLoader, pageLoader } from './index'
import { asyncLoaderWrapper, evalModuleBundleCode, getPageOutputPath, resolveWithType } from './utils'

const loaderName = 'page-json-loader'

/**
 * @type {import('webpack').loader.Loader}
 */
export const pitch = asyncLoaderWrapper(async function () {
  const options = getOptions(this) || {}
  const { appContext } = options

  const { exports: moduleContent } = await evalModuleBundleCode(loaderName, this)

  const imports = []

  if (moduleContent.usingComponents) {
    // 对 comp.json 中读取到的 usingComponents 分别设立为入口
    for (const componentRequest of Object.values(moduleContent.usingComponents)) {
      const resolvedComponentRequest = await resolveWithType(this, 'miniprogram/page', componentRequest)
      const context = appContext || this.context
      const chunkName = getPageOutputPath(context, resolvedComponentRequest)

      imports.push(
        `${externalLoader}?${qs.stringify({
          name: chunkName,
        })}!${pageLoader}?${qs.stringify({
          appContext: context,
          outputPath: chunkName,
        })}!${resolvedComponentRequest}`,
      )
    }
  }

  let code = '//\n'

  for (const importRequest of imports) {
    code += `require(${stringifyRequest(this, importRequest)});\n`
  }

  return code
})

export default source => source