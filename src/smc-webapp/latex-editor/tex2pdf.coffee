###
Convert LaTeX file to PDF.
###

misc                 = require('smc-util/misc')
{required, defaults} = misc
{webapp_client}      = require('../webapp_client')

exports.convert = (opts) ->
    opts = defaults opts,
        path       : required
        project_id : required
        command    : 'latexmk'      # alternative latex build line.
        args       : ['-pdf', '-f', '-g', '-bibtex', '-synctex=1', '-interaction=nonstopmode']
        time       : undefined    # when file was saved
        cb         : required     # cb(err, build output)
    x    = misc.path_split(opts.path)
    args = misc.copy(opts.args).concat(x.tail)
    webapp_client.exec
        allow_post  : false  # definitely could take a long time to fully run latex
        timeout     : 60
        command     : opts.command
        args        : args
        project_id  : opts.project_id
        path        : x.head
        err_on_exit : false
        aggregate   : opts.time
        cb          : opts.cb
