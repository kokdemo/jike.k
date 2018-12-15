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


chrome.runtime.onInstalled.addListener(
    function(){
        chrome.storage.sync.get('topic',function(res){
            if(chrome.runtime.lastError){
                console.info(chrome.runtime.lastError)
                chrome.storage.sync.set({'topic': initTopicList}, function() {
                    console.info('初始化完成，初始topic数据已写入')
                });
            }else{
                console.info('topic读取数据')
                console.info(res)
            }
        })
    }
)

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ? "待注入页面ID:" + sender.tab.id : "from the extension");
        switch(request.command){
            case "insertCss":
                insertCSS(sender.tab.id,sendResponse)
                break;
            case "switchTopic":
                switchTopic(request.topicID,request.topicName,sendResponse)
                break;
            default:
                sendResponse({ response: "jike.k 加载成功，css未注入" });
        }
    }
);

function insertCSS(tabID,sendResponse){
    chrome.tabs.insertCSS(tabID,{ file: 'jike.css'}, function () {
        if (chrome.runtime.lastError) {
            console.info(chrome.runtime.lastError)
            sendResponse({ response: "jike.k 加载失败" });
        } else {
            sendResponse({ response: "jike.k 加载成功" });
        }
    })
}

function switchTopic(topicID,topicName,sendResponse){
    console.info(topicID + topicName)
    chrome.storage.sync.get('topic',function(response){
        if(response.topic.hasOwnProperty(topicID)){
            console.info(response.topic[topicID])
            // 如果数据中包含已知主题，切换状态
            response.topic[topicID].status = !response.topic[topicID].status
            sendResponse({ response: "jike.k 主题状态切换成功" });
        }else{
            // 之前不包含已知主题，新增
            response.topic[topicID] = {name:topicName,status:true};
            sendResponse({ response: "jike.k 主题添加到主题中" });
        }
        console.log(response)
        chrome.storage.sync.set({'topic': response.topic}, function() {
            console.info('topic 数据已经更新')
        });
    })
}