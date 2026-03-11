0. 以下代码适用于Linux服务器，使用Node官网的linux包管理下载
https://nodejs.org/en/download/package-manager

推荐使用NVM安装

根据官网的命令行提示选择并安装Node18及以上版本（推荐安装后缀LTS的版本）

逐行复制页面中的Linux命令到服务器中执行，等待提示完成之后，查看安装的版本是否正确，那之后请重启命令窗口或远程窗口。

接下来使用npm 安装必要的后台运行环境：

1. npm i ws -g
全局安装websocket for node 插件，让node支持websocket协议，若后续第6步使用pm2运行程序失败，则使用cd命令进入第6步的文件夹中使用npm i ws来将插件单独配置到此文件夹中。

2. npm i pm2 -g
全局安装PM2，由于node程序不支持后台运行，而且使用linux自带后台运行是不可靠的，推荐使用PM2来托管你的程序在后台运行（支持程序崩溃时自动重启）

3. 在目录中创建存放服务端代码的文件夹（例如：www/myws） 并将websocketNode.js文件放进去

4. 使用cd命令进入你的文件夹（例如：cd www/myws）

5. 执行命令 npx pm2 start websocketNode.js 即可看到运行提示
如果你需要查看运行过程中打印的log日志，可以在运行代码之后，在此目录下命令行中输入npx pm2 log 0  并回车来查看
（通常情况下你只有一个程序的情况id就是0，如果你运行了多个程序，在执行start命令之后，命令行会显示你本次任务的id，将命令最后的0修改成对应id即可）