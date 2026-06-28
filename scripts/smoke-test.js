const fs = require("fs");
const path = require("path");
const vm = require("vm");

class TestElement {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
    };
    return this.shadowRoot;
  }
}

class TestEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

function runSmokeTest(file) {
  const code = fs.readFileSync(file, "utf8");
  const registry = new Map();
  const context = {
    HTMLElement: TestElement,
    CustomEvent: TestEvent,
    console,
    document: {
      createElement(tag) {
        const Element = registry.get(tag) || TestElement;
        return new Element();
      },
    },
    customElements: {
      get(tag) {
        return registry.get(tag);
      },
      define(tag, Element) {
        registry.set(tag, Element);
      },
    },
    window: {
      customCards: [],
    },
  };

  vm.createContext(context);
  vm.runInContext(code, context, { filename: file });

  const Card = registry.get("caravan-energy-card");
  if (!Card) throw new Error(`${file}: caravan-energy-card was not registered`);

  const card = new Card();
  card.setConfig({
    title: "Smoke Test",
    capacity_ah: 140,
    height: "760px",
    flow_threshold_w: 10,
    entities: {
      battery_soc: "sensor.battery_soc",
      battery_power: "sensor.battery_power",
      battery_current: "sensor.battery_current",
      pv_power: "sensor.pv_power",
      grid_power: "sensor.grid_power",
      load_power: "sensor.load_power",
      ac_active: "binary_sensor.ac_active",
    },
  });

  card.hass = {
    states: {
      "sensor.battery_soc": { state: "82", attributes: { unit_of_measurement: "%" } },
      "sensor.battery_power": { state: "-317", attributes: { unit_of_measurement: "W" } },
      "sensor.battery_current": { state: "-23.6", attributes: { unit_of_measurement: "A" } },
      "sensor.pv_power": { state: "312", attributes: { unit_of_measurement: "W" } },
      "sensor.grid_power": { state: "620", attributes: { unit_of_measurement: "W" } },
      "sensor.load_power": { state: "540", attributes: { unit_of_measurement: "W" } },
      "binary_sensor.ac_active": { state: "on", attributes: {} },
    },
  };

  const html = card.shadowRoot?.innerHTML || "";
  if (html.length < 1000) throw new Error(`${file}: render output is unexpectedly small`);
  if (!html.includes('data-view="battery"')) throw new Error(`${file}: sidebar navigation did not render`);
  if (!html.includes("flow green")) throw new Error(`${file}: flow SVG did not render`);
  if (!html.includes("Smoke Test")) throw new Error(`${file}: title did not render`);

  return { file, htmlLength: html.length };
}

const root = path.resolve(__dirname, "..");
const results = [
  runSmokeTest(path.join(root, "dist", "caravan-energy-card.js")),
  runSmokeTest(path.join(root, "caravan-energy-card.js")),
];

console.log(JSON.stringify({ ok: true, results }, null, 2));
