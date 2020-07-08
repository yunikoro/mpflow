import fs from 'fs'
import path from 'path'
import { Argv, CommandModule } from 'yargs'
import yargs from 'yargs/yargs'
import webpackMerge from 'webpack-merge'
import { Configuration } from 'webpack'
import { Plugin, PluginAPI } from './PluginAPI'

export interface WeflowConfig {
  plugins?: string[]
  configureWebpack?: Configuration
  outputDir?: string
  app?: string | boolean
  pages?: string[]
}

interface PluginOption {
  id: string
  apply: Plugin
}

const interopRequire = (obj: any) => (obj && obj.__esModule ? obj.default : obj)

export default class Service {
  /**
   * service 工作路径
   */
  public context: string

  /**
   * 工作路径上的 package.json 内容
   */
  public pkg: any

  /**
   * 插件列表
   */
  public plugins: PluginOption[]

  /**
   * weflow.config.js 读取到的配置内容
   */
  public config: WeflowConfig

  /**
   * CLI 操作对象
   */
  public program: Argv

  /**
   * webpack 设置
   */
  public webpackConfigs: Configuration[] = []

  constructor(
    context: string,
    { plugins, pkg, config }: { plugins?: PluginOption[]; pkg?: any; config?: WeflowConfig } = {},
  ) {
    this.context = context
    this.pkg = this.resolvePkg(pkg, context)
    this.config = this.resolveConfig(config, context)
    this.plugins = this.resolvePlugins(plugins)
    this.program = yargs()

    this.init()
  }

  init() {
    this.plugins.forEach(({ id, apply }) => {
      apply(new PluginAPI(id, this), this.config)
    })

    if (this.config.configureWebpack) {
      this.webpackConfigs.push(this.config.configureWebpack)
    }
  }

  /**
   * 解析 package.json
   * @param inlinePkg
   * @param context
   */
  resolvePkg(inlinePkg?: any, context: string = this.context): any {
    if (inlinePkg) return inlinePkg
    const pkgPath = path.resolve(context, 'package.json')
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    }
    return {}
  }

  /**
   * 解析 weflow.config.js
   * @param inlineConfig
   * @param context
   */
  resolveConfig(inlineConfig?: WeflowConfig, context: string = this.context): WeflowConfig {
    if (inlineConfig) return inlineConfig
    const configPath = path.resolve(context, 'weflow.config.js')
    if (fs.existsSync(configPath)) {
      return require(configPath)
    }
    return {}
  }

  /**
   * 获取所有插件
   * @param inlinePlugins
   * @param config
   */
  resolvePlugins(inlinePlugins: PluginOption[] = [], config: WeflowConfig = this.config): PluginOption[] {
    const buildInPlugins: PluginOption[] = [
      {
        id: 'built-in:command/build',
        apply: interopRequire(require('./commands/build')),
      },
      {
        id: 'built-in:config/base',
        apply: interopRequire(require('./config/base')),
      },
    ]

    const projectPlugins: PluginOption[] = Object.keys(config.plugins || []).map(id => ({
      id,
      apply: interopRequire(require(id)),
    }))

    return [...buildInPlugins, ...inlinePlugins, ...projectPlugins]
  }

  /**
   * 注册 CLI 命令
   * @param options
   */
  registerCommand<T = {}, U = {}>(options: CommandModule<T, U>) {
    this.program.command(options)
  }

  /**
   * 执行 CLI
   * @param argv
   */
  run(argv: string[] = process.argv.slice(2)) {
    this.program.help().parse(argv)
  }

  /**
   * 获取最终 webpack 配置
   */
  resolveWebpackConfig() {
    return this.webpackConfigs.reduce((config, result) => webpackMerge.merge(result, config))
  }
}
