import { createRequire } from "module";
const require = createRequire(import.meta.url);
const proxy = require('./index');
export default proxy;