import "regenerator-runtime/runtime";
import "whatwg-fetch";
import _ from "underscore";

// jest 24's jsdom predates TextEncoder — browsers all ship it natively.
import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const localStorage = {
  getItem(key) {
    return this[key];
  },
  setItem(key, value) {
    this[key] = value;
  },
  removeItem(key, value) {
    delete this[key];
  },
};

global._ = _;
global.__GJS_VERSION__ = "";
global.grapesjs = require("grapesjs");
global.$ = global.grapesjs.$;
global.localStorage = localStorage;
