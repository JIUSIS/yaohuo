const path = require('path')

module.exports = {
  parser: require('postcss-comment'),
  plugins: [
    require('postcss-import')({
      resolve(id, basedir, importOptions) {
        if (id.startsWith('~@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR || process.cwd(), id.substr(3))
        }
        if (id.startsWith('@/')) {
          return path.resolve(process.env.UNI_INPUT_DIR || process.cwd(), id.substr(2))
        }
        if (id.startsWith('/') && !id.startsWith('//')) {
          return path.resolve(process.env.UNI_INPUT_DIR || process.cwd(), id.substr(1))
        }
        return id
      }
    }),
    require('@dcloudio/vue-cli-plugin-uni/packages/postcss')
  ]
}
