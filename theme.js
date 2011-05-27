/// <reference path="https://ajax.googleapis.com/ajax/libs/jquery/1.6.0/jquery.js" />

var Theme = function () {

	var me = this;

	var elements = ["div"];
	var isElement = function (name) {
		return name in elements;
	};

	this.vbar = {};
	this.hbar = {};
	this.up = {};
	this.down = {};
	this.left = {};
	this.right = {};
	this.vtrack = {};
	this.htrack = {};

	var createNode = function (name, data) {
		var e = $("<" + name + ">");
		for (var p in data) {
			if (isElement(p))
				e.append(createNode(p, data[p]));
			else
				e.css({ p: data[p] });
		}
		return e;
	};

	this.Apply = function (view) {

		view.vbar.elem = createNode("div", me.vbar);
		view.hbar.elem = createNode("div", me.hbar);
		view.up.elem = createNode("div", me.up);
		view.down.elem = createNode("div", me.down);
		view.left.elem = createNode("div", me.left);
		view.right.elem = createNode("div", me.right);
		view.vtrack.elem = createNode("div", me.vtrack);
		view.htrack.elem = createNode("div", me.htrack);

	};

};