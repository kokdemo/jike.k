var topics = {
    '556688fae4b00c57d9dd46ee':{name:'今日份的摄影'},
    '57b86fb59b06f01200f89410':{name:'街头摄影扫街组'},
    '5b67fbd3a7d6a90017630366':{name:'人文纪实摄影组'},
    '5b6a90ec69f2e00017b0bb17':{name:'一起拍建筑'},
    '5b7d2e3aaa31960017c5a206':{name:'一起拍写真'},
    '5b6a907bc0798a00176cf893':{name:'一起拍星空'},
    '5740760391dbb11100594646':{name:'摄影鉴赏会'},
    '56ac86b95761ff120077b341':{name:'随手拍张照'},
    '5a1ccd886b3e9800116b7fe9':{name:'此刻的天空'}
}

// 获取url，判断是否要加载css
var regex = /topic+\/\w+/;
var id = regex.exec(window.location.pathname)[0].split('/')[1];
console.log(topics.hasOwnProperty(id));
if(topics.hasOwnProperty(id) == true){
    chrome.runtime.sendMessage({command: "insertCss"}, function(response) {
        // 给精选的标题增加title
        var topic = document.getElementsByClassName('topic-info-main')[0];
        var topicName = topic.childNodes[0].innerText;
        var tab = document.getElementsByClassName('tab-title')[0];
        tab.innerText = topicName +" "+ tab.innerText;
    });
}else{
    console.log('当前页面不加载jike.k');
}

