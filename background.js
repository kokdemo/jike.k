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