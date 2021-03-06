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
function routeInit() {
  let topicRegex = /topic+\/\w+/;
  let path = window.location.pathname;
  let result = { route: "", info: "" };
  // console.info(path)
  if (path == "/feed" || path == "/feed/message" || path == "/feed/post") {
    // 在首页
    result.route = "index"
  } else if (path.indexOf("/topic/") > -1) {
    // 在话题页
    result = {
      route: "topic",
      info: topicRegex.exec(window.location.pathname)[0].split('/')[1]
    }
  }
  // console.info(result)
  return result
}
console.info('load')
// 获取url
whenReady(function(){
  var routeRes = routeInit();
  console.info(routeRes)
  if (routeRes.route == "topic") {
    topicInit(routeRes.info);
    // console.info("此时在" + routeRes.route)
  } else {
    addNav(true)
    console.info("此时在" + routeRes.route)
  }
  // 修复下拉框问题
  chrome.runtime.sendMessage({command: "fixDropDownMenu"}, function(response) {
    // console.log('fix css bug')
  });
})

// 获取列表名单
function topicInit(topicID){
  chrome.storage.sync.get('topic', function(response) {
      // 判断是否要加载css
      if(response.hasOwnProperty('topic')){
          // 说明有数据
          if(response.topic.hasOwnProperty(topicID) && response.topic[topicID].status){
              // 如果在名单内，发送插入 css 的指令，给页面加入 dom
              chrome.runtime.sendMessage({command: "insertCss"}, function(response) {
                  addTitle()
                  addNav(true)
              });
          }else{
              console.log('当前页面不加载jike.k');
              addNav(false)
          }
      }else{
          // 没数据，请求后台初始化
          chrome.runtime.sendMessage({command: "initData"}, function(response) {
              window.location.reload()
          });
      }  
  });
}


function addTitle(){
  // 给精选的标题增加title
  let topic = document.getElementsByClassName('topic-info-main')[0];
  let topicName = topic.childNodes[0].innerText;
  let tab = document.getElementsByClassName('tab-title')[0];
  tab.innerText = topicName +" "+ tab.innerText;
}

function addNav(status){
  var routeRes = routeInit();
  // 修改顶部tab
  let inferDom = document.getElementById('user-menu-downshift-menu');
  let ref = inferDom.children[1]
  let insertDom = document.createElement('li')
  insertDom.innerHTML = '<span class="header-item hidden-xs header-item-icon nav-switch-off" id="switchDom" style="background:url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiA/PjxzdmcgaGVpZ2h0PSIxNHB4IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxOSAxNCIgd2lkdGg9IjE5cHgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6c2tldGNoPSJodHRwOi8vd3d3LmJvaGVtaWFuY29kaW5nLmNvbS9za2V0Y2gvbnMiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48dGl0bGUvPjxkZXNjLz48ZGVmcy8+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIiBpZD0iUGFnZS0xIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSI+PGcgZmlsbD0iIzAwMDAwMCIgaWQ9IkNvcmUiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC04Ny4wMDAwMDAsIC01MDkuMDAwMDAwKSI+PGcgaWQ9InZpZXctbGlzdCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoODcuNTAwMDAwLCA1MDkuMDAwMDAwKSI+PHBhdGggZD0iTTAsOSBMNCw5IEw0LDUgTDAsNSBMMCw5IEwwLDkgWiBNMCwxNCBMNCwxNCBMNCwxMCBMMCwxMCBMMCwxNCBMMCwxNCBaIE0wLDQgTDQsNCBMNCwwIEwwLDAgTDAsNCBMMCw0IFogTTUsOSBMMTcsOSBMMTcsNSBMNSw1IEw1LDkgTDUsOSBaIE01LDE0IEwxNywxNCBMMTcsMTAgTDUsMTAgTDUsMTQgTDUsMTQgWiBNNSwwIEw1LDQgTDE3LDQgTDE3LDAgTDUsMCBMNSwwIFoiIGlkPSJTaGFwZSIvPjwvZz48L2c+PC9nPjwvc3ZnPg==) no-repeat center/60%"></span>';
  inferDom.insertBefore(insertDom,ref)
  // document.getElementById('switchDom').addEventListener('click',switchStatus)
}

function switchStatus(){
  let topic = document.getElementsByClassName('topic-info-main')[0];
  let routeRes = routeInit();
  let topicID = routeRes.info;
  let topicName = topic.childNodes[0].innerText;
  // 切换状态，修改 storage 中的数据，然后刷新页面
  chrome.runtime.sendMessage({command: "switchTopic",topicID:topicID,topicName:topicName}, function(response) {
      window.location.reload()
  })
}