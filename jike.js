whenReady = (function() {
    var funcs = [],
        ready = false;
    function handler(e) {
      if (ready) {
        return;
      }
      if (e.type === 'onreadystatechange' && document.readyState !== 'complete') {
        return;
      }
      var i = 0;
      for (i = 0; i < funcs.length; i++) {
        funcs[i].call(document);
      }
      ready = true;
      funcs = null;
    }
    if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', handler, false);
      document.addEventListener('readystatechange', handler, false); // IE9+
      window.addEventListener('load', handler, false);
    } else if (document.attachEvent) {
      document.attachEvent('onreadystatechange', handler);
      window.attachEvent('onload', handler);
    }
    return function(fn) {
      if (ready) {
        fn.call(document);
      } else {
        funcs.push(fn);
      }
    };
})();


// 获取url
var regex = /topic+\/\w+/;
var topicID = regex.exec(window.location.pathname)[0].split('/')[1];
whenReady(function(){
    topicInit();
})

// 获取列表名单
function topicInit(){
    chrome.storage.sync.get('topic', function(response) {
        // 判断是否要加载css
        console.log(response);
        if(response.topic.hasOwnProperty(topicID) && response.topic[topicID].status){
            // 如果在名单内，发送插入 css 的指令，给页面加入 dom
            chrome.runtime.sendMessage({command: "insertCss"}, function(response) {
                addTitle()
            });
        }else{
            console.log('当前页面不加载jike.k');
        }
        addNav()
    });
}


function addTitle(){
    // 给精选的标题增加title
    let topic = document.getElementsByClassName('topic-info-main')[0];
    let topicName = topic.childNodes[0].innerText;
    let tab = document.getElementsByClassName('tab-title')[0];
    tab.innerText = topicName +" "+ tab.innerText;
}

function addNav(){
    // 修改顶部tab
    let switchDom = document.getElementsByClassName('row no-margin end-xs middle-xs is-flex middle-xs')[0].children[0];
    switchDom.outerHTML = '<span class="header-item hidden-xs" id="switchDom">切换</a>';
    document.getElementById('switchDom').addEventListener('click',switchStatus)
    console.log('nav success')
}

function switchStatus(){
    let topic = document.getElementsByClassName('topic-info-main')[0];
    let topicName = topic.childNodes[0].innerText;
    // 切换状态，修改 storage 中的数据，然后刷新页面
    chrome.runtime.sendMessage({command: "switchTopic",topicID:topicID,topicName:topicName}, function(response) {
        window.location.reload()
    })
}