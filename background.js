var initTopicList = {
    '556688fae4b00c57d9dd46ee':{name:'今日份的摄影',status:true},
    '57b86fb59b06f01200f89410':{name:'街头摄影扫街组',status:true},
    '5b67fbd3a7d6a90017630366':{name:'人文纪实摄影组',status:true},
    '5b6a90ec69f2e00017b0bb17':{name:'一起拍建筑',status:true},
    '5b7d2e3aaa31960017c5a206':{name:'一起拍写真',status:true},
    '5b6a907bc0798a00176cf893':{name:'一起拍星空',status:true},
    '5740760391dbb11100594646':{name:'摄影鉴赏会',status:true},
    '56ac86b95761ff120077b341':{name:'随手拍张照',status:true},
    '5a1ccd886b3e9800116b7fe9':{name:'此刻的天空',status:true}
}


chrome.runtime.onStartup.addListener(
    function(){
        chrome.storage.sync.set({'topic': initTopicList}, function() {
            console.info('初始化完成，初始topic数据已写入')
        });
    }
)


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ? "待注入页面ID:" + sender.tab.id : "from the extension");
        // 如果指令是注入css
        if (request.command == "insertCss"){
            chrome.tabs.insertCSS(sender.tab.id,{ file: 'jike.css'}, function () {
                if (chrome.runtime.lastError) {
                    console.info(chrome.runtime.lastError)
                    sendResponse({ response: "jike.k 加载失败" });
                } else {
                    sendResponse({ response: "jike.k 加载成功" });
                }
            })
        }else{
            sendResponse({ response: "jike.k 加载成功，css未注入" });
        }
    }
);