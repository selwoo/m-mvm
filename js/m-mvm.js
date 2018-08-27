/*Mmvm构造函数
 * @param {options} 参数对象，包含两个属性，{el:容器元素的选择器,data:预定义数据列表}
 */
function Mmvm(options) {
	//安全作用域
	if(!(this instanceof Mmvm)) return new Mmvm(options);
	//构造函数定义实例属性
	this.data = options.data;
	this.watcherGroup = {};
	this.nodeToFragment(document.querySelector(options.el));
	//把当前页面加入到缓存记录中
	var mpages = localStorage['mmvm-pages'] ? JSON.parse(localStorage['mmvm-pages']) : [];
	if(mpages.indexOf(plus.webview.currentWebview().id) == -1){
		mpages.push(plus.webview.currentWebview().id);
		localStorage['mmvm-pages'] = JSON.stringify(mpages);
	}
	//自定义更新数据事件
	var _this = this;
	window.addEventListener('mmvm-update',function(e){
		var eventData = e.detail;
		for(var key in eventData){
			_this.data[key] = eventData[key];
		}
	});
}
//原型模式定义方法和共享的属性
Mmvm.prototype = {
	constructor:Mmvm,
	/*遍历容器所有节点
	 * @param {container} 容器的元素节点对象
	 */
	nodeToFragment:function(container){
		//把容器克隆到文档片段里，提高编译性能
		var flag = document.createDocumentFragment();
		flag.appendChild(container.cloneNode(true));
		//创建深度遍历实例
    	var walker = document.createNodeIterator(flag,NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,null,false);
    	var node = walker.nextNode();
    	while (node !== null) {
    		this.compile(node);
    		node = walker.nextNode();
    	}
    	//编译完成后，将文档片段返回到容器中
    	container.innerHTML = '';
    	container.appendChild(flag.firstChild);
    	this.observe();
	},
	/*处理节点
	 * @param {node} 需要编译的节点对象
	 */
	compile:function(node){
		switch (node.nodeType){
			//元素节点
			case 1:
				if(node.attributes['m-model']){
					var name = node.attributes['m-model'].value; //获取 m-model 绑定的属性名
		            node.value = this.data[name] || ''; // 将 data 的值赋给该 node
		            node.removeAttribute('m-model');
		            this.watcher(node, name);
		            //绑定输入事件
		            var _this = this;
		            node.addEventListener('input', function (e) {
		            	//关联页面同步更新
						var eventData = {},
							savePages = false,
							mpages = JSON.parse(localStorage['mmvm-pages']);
						eventData[name] = e.target.value;
						//遍历所有设置了mmvm的页面更新数据
						mpages.concat().forEach(function(n){
		            		var webview = plus.webview.getWebviewById(n)
		            		if(webview){
		            			webview.evalJS("window.dispatchEvent(new CustomEvent('mmvm-update', {detail: " + JSON.stringify(eventData) + ",bubbles: true,cancelable: true}))");
							}else{
								mpages.splice(mpages.indexOf(n),1);
								savePages = true;
							}
		            	});
		            	//删除已关闭的页面
						if(savePages) localStorage['mmvm-pages'] = JSON.stringify(mpages);
		            });
				}
				break;
			//文本节点
			case 3:
				var _this = this;
				(function(reg,text){
					if(reg.test(text)){
						//补全捕获项左边文本
						if(RegExp["$`"].length > 0){
							var leftTextNode = document.createTextNode(RegExp["$`"]);
							node.parentNode.insertBefore(leftTextNode,node);
						}
						//创建捕获项对应视图
						var name = RegExp["$+"];
						var viewNode = document.createTextNode(_this.data[name] || '');
						node.parentNode.insertBefore(viewNode,node);
						_this.watcher(viewNode, name);
						//继续匹配下一个捕获项
						var right = RegExp["$'"];
						if(right.length > 0){
							if(reg.test(right)){
								arguments.callee(reg,right);
							}else{
								//补全捕获项右边文本
								var rightTextNode = document.createTextNode(right);
								node.parentNode.insertBefore(rightTextNode,node);
							}
						}
					}
				})(/{{(.*?)}}/,node.nodeValue);
				node.nodeValue = '';
				/*var matches = node.nodeValue.match(/{{(.*?)}}/g);
				if (matches) {
					node.nodeValue = '';
					for (var i = 0,len = matches.length;i < len;i++) {
						var name = matches[i].slice(2,-2).trim();
						
						var newTextNode = document.createTextNode(this.data[name] || '');
						node.parentNode.insertBefore(newTextNode,node);
						this.watcher(newTextNode, name);
					}
		        }*/
				break;
			default:
				break;
		}
	},
	/*把节点放到对应的观察组
	 * @param {node} 观察者节点对象
	 * @param {name} 观察者观察的属性名
	 */
	watcher:function(node, name){
		if(!(name in this.data)) this.data[name] = '';
		if(!(name in this.watcherGroup)) this.watcherGroup[name] = [];
		this.watcherGroup[name].push(node);
	},
	//监听数据
	observe:function(){
		for(var key in this.data){
			this.defineReactive(key, this.data[key]);
		}
	},
	/*把数据属性都覆写成访问器属性
	 * @param {key} 属性名
	 * @param {value} 属性值
	 */
	defineReactive:function(key, value){
		var _this = this;
		Object.defineProperty(this.data, key, {
	        get: function () {
	        	return value;
	        },
	        set: function (newVal) {
	        	if (newVal === value) return;
	        	value = newVal;
	        	//直接更新视图
	        	_this.updateView(key);
	        }
    	});
	},
	/*更新视图
	 * @param {key} 指定需要更新的属性名
	 */
	updateView:function(key){
		var group = this.watcherGroup[key],
			value = this.data[key];
		for (var i = 0,len = group.length;i < len;i++) {
			var watcher = group[i];
		    if (watcher.nodeType === 1) {
		    	watcher.value = value;
		    }else if (watcher.nodeType === 3) {
		    	watcher.nodeValue = value;
		    }
		}
	}
}
