import cp from 'child_process'
import fs from 'fs'
import { Plugin } from '../PluginAPI'
import { Compiler, Stats } from 'webpack'

const getDevtoolCliPath = async () => {
  let cliPath: string
  if (process.platform === 'darwin') {
    cliPath = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
  } else if (process.platform === 'win32') {
    cliPath = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
  } else {
    // 其余平台暂不支持
    throw new Error('unsupported platform')
  }
  const exists = await new Promise<boolean>(resolve => fs.exists(cliPath, resolve))
  if (!exists) {
    // 找不到开发工具
    throw new Error('cannot find Wechat web devTools')
  }
  return cliPath
}

const openDevtool = async (path: string) => {
  const cliPath = await getDevtoolCliPath()
  const child = cp.spawn(cliPath, ['open', '--project', path], {
    detached: true,
    stdio: 'inherit',
  })
  child.unref()
}

interface DevContext {
  compiler: Compiler
  stats?: Stats
}

const printStats = (compiler: Compiler, stats: Stats) => {
  process.stdout.write(stats.toString('errors-warnings') + '\n\n')
}

const setupHooks = (context: DevContext, firstDone: () => void) => {
  let _firstDone = true

  const invalid = () => {
    context.stats = undefined
  }

  const done = (stats: Stats) => {
    context.stats = stats

    process.nextTick(() => {
      const { stats, compiler } = context
      if (!stats) return

      if (_firstDone) {
        _firstDone = false
        firstDone()
      }

      printStats(compiler, stats)
    })
  }

  const { compiler } = context

  compiler.hooks.watchRun.tap('miniprogram-dev', invalid)
  compiler.hooks.invalid.tap('miniprogram-dev', invalid)
  compiler.hooks.done.tap('miniprogram-dev', done)
}

const dev: Plugin = (api, config) => {
  api.registerCommand(
    'dev',
    '启动开发模式构建',
    {
      open: {
        boolean: true,
        description: '是否启动小程序开发工具',
      },
    },
    async args => {
      api.mode = 'development'

      const { default: webpack, ProgressPlugin } = await import('webpack')

      api.configureWebpack(webpackConfig => {
        webpackConfig.watch(true)

        webpackConfig.plugin('progress').use(ProgressPlugin, [{}])
      })

      const webpackConfig = api.resolveWebpackConfig()

      const compiler = webpack(webpackConfig)

      const context: DevContext = {
        compiler,
      }

      setupHooks(context, () => {
        if (args.open) {
          openDevtool(api.resolve('dist'))
        }
      })

      compiler.watch(
        {
          aggregateTimeout: 1000,
          poll: undefined,
        },
        err => {
          if (err) {
            console.error(err)
          }
        },
      )
    },
  )
}

export default dev
