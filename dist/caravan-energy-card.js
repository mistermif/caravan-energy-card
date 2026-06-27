const CARD_VERSION = "0.3.0";
const CARD_TAG = "caravan-energy-card";
const EDITOR_TAG = "caravan-energy-card-editor";

const ENTITY_FIELDS = [
  ["battery_soc", "Batteria SOC", ["sensor"]],
  ["battery_voltage", "Batteria tensione", ["sensor"]],
  ["battery_current", "Batteria corrente", ["sensor"]],
  ["battery_power", "Batteria potenza", ["sensor"]],
  ["battery_temp", "Batteria temperatura", ["sensor"]],
  ["battery_runtime", "Autonomia residua", ["sensor"]],
  ["battery_cycles", "Cicli batteria", ["sensor"]],
  ["battery_energy", "Energia/capacita batteria", ["sensor"]],
  ["grid_voltage", "Rete tensione", ["sensor"]],
  ["grid_current", "Rete corrente", ["sensor"]],
  ["grid_power", "Rete potenza", ["sensor"]],
  ["grid_frequency", "Rete frequenza", ["sensor"]],
  ["grid_energy", "Rete energia oggi", ["sensor"]],
  ["pv_voltage", "Fotovoltaico tensione", ["sensor"]],
  ["pv_current", "Fotovoltaico corrente", ["sensor"]],
  ["pv_power", "Fotovoltaico potenza", ["sensor"]],
  ["pv_energy", "Fotovoltaico energia oggi", ["sensor"]],
  ["load_voltage", "Caravan tensione", ["sensor"]],
  ["load_power", "Caravan potenza", ["sensor"]],
  ["load_frequency", "Caravan frequenza", ["sensor"]],
  ["load_percent", "Carico percentuale", ["sensor"]],
  ["alarm", "Allarme inverter", ["binary_sensor"]],
  ["ac_active", "Rete AC attiva", ["binary_sensor"]],
  ["mppt_temp", "Temperatura MPPT", ["sensor"]],
  ["inverter_temp", "Temperatura inverter", ["sensor"]],
  ["bay_temp", "Temperatura vano tecnico", ["sensor"]],
  ["internal_temp", "Temperatura interna", ["sensor"]],
  ["external_temp", "Temperatura esterna", ["sensor"]],
  ["battery_service_temp", "Temperatura batteria servizi", ["sensor"]],
  ["output_priority", "Priorita uscita", ["select", "sensor"]],
  ["charger_priority", "Priorita carica", ["select", "sensor"]],
  ["utility_current", "Corrente carica rete", ["select", "sensor"]],
  ["max_charge_current", "Corrente massima carica", ["sensor", "number", "select"]],
];

const DEFAULT_CONFIG = {
  title: "SISTEMA ENERGIA - POWMR HVM12V 2KW",
  capacity_ah: 140,
  height: "clamp(680px, calc(100dvh - 120px), 920px)",
  flow_threshold_w: 10,
  animation: true,
  entities: {},
};

class CaravanEnergyCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: `custom:${CARD_TAG}`,
      title: DEFAULT_CONFIG.title,
      capacity_ah: DEFAULT_CONFIG.capacity_ah,
      height: DEFAULT_CONFIG.height,
      flow_threshold_w: DEFAULT_CONFIG.flow_threshold_w,
      animation: true,
      entities: {},
    };
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  setConfig(config) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      entities: {
        ...DEFAULT_CONFIG.entities,
        ...(config?.entities || {}),
      },
    };
    this.samples = [];
    this.activeView = this.activeView || "overview";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this._pushSample();
    this._render();
  }

  getCardSize() {
    return 12;
  }

  _entity(key, fallback) {
    return this.config.entities?.[key] || fallback;
  }

  _state(entity, fallback = "--") {
    const state = this._hass?.states?.[entity];
    if (!state || state.state === "unknown" || state.state === "unavailable") return fallback;
    return state.state;
  }

  _unit(entity, fallback = "") {
    return this._hass?.states?.[entity]?.attributes?.unit_of_measurement || fallback;
  }

  _num(entity, fallback = 0) {
    const value = Number.parseFloat(this._state(entity, ""));
    return Number.isFinite(value) ? value : fallback;
  }

  _fmt(entity, digits = 0, fallbackUnit = "") {
    const value = this._num(entity, NaN);
    if (!Number.isFinite(value)) return "--";
    const unit = this._unit(entity, fallbackUnit);
    return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
  }

  _text(entity, fallback = "--") {
    const state = this._state(entity, fallback);
    return String(state).replaceAll("_", " ");
  }

  _pushSample() {
    const now = Date.now();
    if (this.samples.length && now - this.samples[this.samples.length - 1].t < 120000) return;
    const pv = this._num(this._entity("pv_power", "sensor.powmr2kw_pv_power"));
    const grid = this._num(this._entity("grid_power", "sensor.inverter_cooling_pzem_power"));
    const batt = this._num(this._entity("battery_power", "sensor.batteria_knaus_potenza"));
    const load = this._num(this._entity("load_power", "sensor.powmr2kw_load_power"));
    this.samples.push({ t: now, pv, grid, batt, load });
    if (this.samples.length > 48) this.samples.shift();
  }

  _spark(points, key, color) {
    const width = 310;
    const height = 112;
    const values = points.map((item) => Number(item[key]) || 0);
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));
    const step = width / Math.max(1, values.length - 1);
    const path = values
      .map((value, index) => {
        const x = index * step;
        const y = height / 2 - (value / max) * (height * 0.42);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
  }

  _render() {
    if (!this._hass) return;

    const e = {
      batterySoc: this._entity("battery_soc", "sensor.livello_batteria_knaus"),
      batteryVoltage: this._entity("battery_voltage", "sensor.batteria_knaus_tensione"),
      batteryCurrent: this._entity("battery_current", "sensor.batteria_knaus_corrente"),
      batteryPower: this._entity("battery_power", "sensor.batteria_knaus_potenza"),
      batteryTemp: this._entity("battery_temp", "sensor.batteria_knaus_temperatura"),
      batteryRuntime: this._entity("battery_runtime", "sensor.batteria_knaus_runtime"),
      batteryCycles: this._entity("battery_cycles", "sensor.batteria_knaus_cycles"),
      batteryEnergy: this._entity("battery_energy", "sensor.batteria_knaus_energia_immagazzinata"),
      gridVoltage: this._entity("grid_voltage", "sensor.inverter_cooling_pzem_voltage"),
      gridCurrent: this._entity("grid_current", "sensor.inverter_cooling_pzem_current"),
      gridPower: this._entity("grid_power", "sensor.inverter_cooling_pzem_power"),
      gridFrequency: this._entity("grid_frequency", "sensor.inverter_cooling_pzem_frequency"),
      gridEnergy: this._entity("grid_energy", "sensor.pzem_day"),
      pvVoltage: this._entity("pv_voltage", "sensor.powmr2kw_pv_voltage"),
      pvCurrent: this._entity("pv_current", "sensor.powmr2kw_pv_current"),
      pvPower: this._entity("pv_power", "sensor.powmr2kw_pv_power"),
      pvEnergy: this._entity("pv_energy", "sensor.produzione_fv_giornaliera"),
      loadVoltage: this._entity("load_voltage", "sensor.powmr2kw_load_voltage"),
      loadPower: this._entity("load_power", "sensor.powmr2kw_load_power"),
      loadFrequency: this._entity("load_frequency", "sensor.powmr2kw_load_frequency"),
      loadPercent: this._entity("load_percent", "sensor.powmr2kw_load_percent"),
      alarm: this._entity("alarm", "binary_sensor.powmr2kw_alarm"),
      acActive: this._entity("ac_active", "binary_sensor.powmr2kw_ac_active"),
      mpptTemp: this._entity("mppt_temp", "sensor.inverter_cooling_temp_mppt"),
      inverterTemp: this._entity("inverter_temp", "sensor.inverter_cooling_temp_220"),
      bayTemp: this._entity("bay_temp", "sensor.inverter_cooling_temp_vano_tecnico"),
      internalTemp: this._entity("internal_temp", "sensor.caravan_sensor_interno_temperatura"),
      externalTemp: this._entity("external_temp", "sensor.caravan_sensor_esterno_temperatura"),
      batteryServiceTemp: this._entity("battery_service_temp", "sensor.caravan_sensor_batteria_servizi_temperatura"),
      outputPriority: this._entity("output_priority", "select.powmr2kw_output_source_priority"),
      chargerPriority: this._entity("charger_priority", "select.powmr2kw_charger_source_priority"),
      utilityCurrent: this._entity("utility_current", "select.powmr2kw_utility_charge_current"),
      maxChargeCurrent: this._entity("max_charge_current", "sensor.powmr2kw_max_total_charging_current"),
    };

    const soc = Math.max(0, Math.min(100, this._num(e.batterySoc, 0)));
    const pvPower = this._num(e.pvPower, 0);
    const gridPower = this._num(e.gridPower, 0);
    const batteryPower = this._num(e.batteryPower, 0);
    const loadPower = this._num(e.loadPower, 0);
    const batteryMode = batteryPower < 0 ? "SCARICA" : batteryPower > 0 ? "CARICA" : "STABILE";
    const alarm = this._state(e.alarm, "off") === "on";
    const acActive = this._state(e.acActive, "off") === "on";
    const animation = this.config.animation !== false;
    const capacity = Number(this.config.capacity_ah) || DEFAULT_CONFIG.capacity_ah;
    const cardHeight = this.config.height || DEFAULT_CONFIG.height;
    const flowThreshold = Number(this.config.flow_threshold_w) || DEFAULT_CONFIG.flow_threshold_w;
    const activeView = this.activeView || "overview";
    const now = new Date();
    const sampleSeed = this.samples.length > 2
      ? this.samples
      : Array.from({ length: 24 }, (_, index) => {
          const wave = Math.sin(index / 4) * 0.7 + Math.sin(index / 9) * 0.4;
          return {
            pv: Math.max(0, this._num(e.pvPower) * (0.35 + index / 34)),
            grid: this._num(e.gridPower) * (0.65 + wave * 0.15),
            batt: this._num(e.batteryPower) * (0.7 + wave * 0.18),
            load: this._num(e.loadPower) * (0.72 + wave * 0.12),
          };
        });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --bg: #03080d;
          --panel: rgba(4, 19, 29, 0.88);
          --panel2: rgba(3, 15, 24, 0.94);
          --line: rgba(0, 164, 255, 0.48);
          --blue: #00a2ff;
          --green: #25e04f;
          --orange: #ff8a00;
          --red: #ff3b30;
          --muted: #8ca1af;
          color: #e8f4ff;
          font-family: "Rajdhani", "Roboto Condensed", "Arial Narrow", Arial, sans-serif;
        }

        ha-card {
          overflow: hidden;
          border: 1px solid rgba(0, 162, 255, 0.34);
          border-radius: 8px;
          background:
            radial-gradient(circle at 52% 34%, rgba(0, 120, 255, 0.16), transparent 26%),
            radial-gradient(circle at 78% 15%, rgba(0, 162, 255, 0.10), transparent 22%),
            linear-gradient(120deg, #02060a 0%, #05121b 48%, #02060a 100%);
          box-shadow: inset 0 0 38px rgba(0, 162, 255, 0.08), 0 18px 50px rgba(0, 0, 0, 0.46);
        }

        .dash {
          height: var(--card-height, clamp(680px, calc(100dvh - 120px), 920px));
          min-height: 0;
          display: grid;
          grid-template-columns: clamp(168px, 12vw, 215px) minmax(0, 1fr);
          overflow: hidden;
        }

        .sidebar {
          border-right: 1px solid rgba(0, 162, 255, 0.26);
          background: linear-gradient(180deg, rgba(2, 8, 13, 0.98), rgba(3, 13, 20, 0.94));
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .brand {
          height: 56px;
          display: grid;
          align-content: center;
          padding-left: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .tm {
          color: #ff2430;
          font-weight: 900;
          font-size: 30px;
          font-style: italic;
          letter-spacing: 1px;
          line-height: 1;
        }

        .tm span {
          color: #d9e8f4;
          font-size: 18px;
          margin-left: 4px;
        }

        .brand small {
          color: #7f93a4;
          font-size: 9px;
          letter-spacing: 2px;
          margin-left: 33px;
        }

        .nav {
          display: grid;
          gap: 8px;
        }

        .nav-item {
          appearance: none;
          width: 100%;
          height: 44px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 15px;
          background: transparent;
          color: #d7e8f5;
          border: 1px solid transparent;
          font-size: 13px;
          font: inherit;
          letter-spacing: 0.5px;
          cursor: pointer;
          text-align: left;
        }

        .nav-item.active {
          background: linear-gradient(180deg, #0573df, #004fa8);
          border-color: rgba(65, 179, 255, 0.7);
          box-shadow: inset 0 0 22px rgba(255, 255, 255, 0.12), 0 0 20px rgba(0, 120, 255, 0.25);
        }

        .nav-item ha-icon {
          --mdc-icon-size: 22px;
          color: #eaf7ff;
        }

        .side-box {
          border: 1px solid rgba(123, 178, 207, 0.25);
          border-radius: 8px;
          background: rgba(3, 14, 22, 0.88);
          padding: 13px 16px;
          margin-top: auto;
        }

        .side-box + .side-box {
          margin-top: 0;
        }

        .side-title {
          color: #8da7ba;
          font-size: 11px;
          letter-spacing: 0.7px;
          margin-bottom: 11px;
        }

        .state-line {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--green);
          font-size: 12px;
          margin: 8px 0;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 12px currentColor;
          flex: 0 0 auto;
        }

        .main {
          display: grid;
          grid-template-rows: 56px 1fr 64px;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .topbar {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          border-bottom: 1px solid rgba(0, 162, 255, 0.25);
          padding: 0 28px;
          background: rgba(1, 7, 12, 0.55);
        }

        .title {
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .top-meta {
          display: flex;
          align-items: center;
          gap: 18px;
          color: #dbe8f2;
          font-size: 13px;
          white-space: nowrap;
        }

        .top-meta ha-icon {
          --mdc-icon-size: 20px;
          color: #e7f5ff;
        }

        .canvas {
          position: relative;
          padding: clamp(8px, 0.75vw, 14px);
          display: grid;
          grid-template-columns: minmax(210px, 0.82fr) minmax(330px, 1.4fr) minmax(230px, 0.92fr) minmax(280px, 1.1fr);
          grid-template-rows: minmax(250px, 1.55fr) minmax(145px, 0.86fr) minmax(135px, 0.82fr);
          gap: clamp(8px, 0.75vw, 14px);
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .card {
          position: relative;
          border: 1px solid rgba(0, 162, 255, 0.36);
          border-radius: 8px;
          background:
            linear-gradient(180deg, rgba(0, 85, 150, 0.26), transparent 36px),
            var(--panel);
          box-shadow: inset 0 0 24px rgba(0, 162, 255, 0.06);
          overflow: hidden;
          min-height: 0;
        }

        .card::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
          background-size: 32px 32px;
          opacity: 0.55;
        }

        .card-title {
          height: clamp(31px, 3.8vh, 36px);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.7px;
          background: linear-gradient(180deg, rgba(0, 111, 204, 0.72), rgba(0, 55, 88, 0.38));
          border-bottom: 1px solid rgba(0, 162, 255, 0.22);
        }

        .card-title ha-icon {
          --mdc-icon-size: 24px;
        }

        .metric {
          display: grid;
          gap: 2px;
          padding: clamp(5px, 0.7vh, 8px) 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .metric small {
          color: #b3c5d2;
          font-size: 10px;
          letter-spacing: 0.6px;
        }

        .metric strong {
          color: var(--blue);
          font-size: clamp(17px, 1.35vw, 21px);
          font-weight: 800;
          line-height: 1.1;
          text-shadow: 0 0 12px rgba(0, 162, 255, 0.35);
        }

        .metric.green strong { color: var(--green); }
        .metric.orange strong { color: var(--orange); }
        .metric.red strong { color: var(--red); }

        .source-card {
          display: grid;
          grid-template-columns: 1fr 95px;
          min-height: 0;
        }

        .source-art {
          position: relative;
          min-height: 0;
          display: grid;
          place-items: center;
        }

        .tower {
          width: clamp(68px, 5.2vw, 90px);
          height: clamp(132px, 10.6vw, 178px);
          position: relative;
          opacity: 0.9;
          filter: drop-shadow(0 0 16px rgba(120, 200, 255, 0.22));
        }

        .tower::before,
        .tower::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(64deg, transparent 47%, rgba(195, 226, 245, 0.9) 48%, rgba(195, 226, 245, 0.9) 51%, transparent 52%),
            linear-gradient(-64deg, transparent 47%, rgba(195, 226, 245, 0.7) 48%, rgba(195, 226, 245, 0.7) 51%, transparent 52%),
            repeating-linear-gradient(0deg, transparent 0 28px, rgba(195, 226, 245, 0.45) 29px 31px);
          clip-path: polygon(48% 0, 62% 0, 96% 100%, 4% 100%);
        }

        .solar-panel {
          width: clamp(104px, 7.6vw, 126px);
          height: clamp(72px, 5.2vw, 86px);
          transform: perspective(320px) rotateX(56deg) rotateZ(7deg);
          background:
            linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px),
            linear-gradient(135deg, #123c72, #051529);
          background-size: 24px 100%, 100% 20px, auto;
          border: 2px solid rgba(210, 235, 255, 0.7);
          box-shadow: 0 20px 30px rgba(0, 0, 0, 0.35), 0 0 24px rgba(0, 162, 255, 0.18);
        }

        .solar-panel::after {
          content: "";
          position: absolute;
          width: 6px;
          height: 70px;
          background: #748999;
          left: 58px;
          top: 76px;
          transform: rotateZ(-7deg);
        }

        .source-metrics {
          padding: clamp(28px, 4.2vh, 44px) 16px 0 0;
          z-index: 1;
        }

        .status-pill {
          position: absolute;
          left: 11px;
          bottom: 11px;
          min-width: 116px;
          border: 1px solid rgba(130, 180, 210, 0.25);
          background: rgba(3, 16, 25, 0.75);
          border-radius: 7px;
          padding: 9px 12px;
          z-index: 1;
        }

        .status-pill small {
          display: block;
          color: #b5c7d2;
          font-size: 10px;
        }

        .status-pill strong {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--green);
          font-size: 11px;
        }

        .inverter {
          grid-column: 2;
          grid-row: 1;
          width: min(100%, 420px);
          justify-self: center;
        }

        .inverter-body {
          position: relative;
          height: calc(100% - clamp(31px, 3.8vh, 36px));
          min-height: 200px;
          display: grid;
          place-items: center;
        }

        .inverter-box {
          width: clamp(178px, 13.6vw, 220px);
          height: clamp(184px, 14vw, 228px);
          border-radius: 9px;
          background:
            linear-gradient(180deg, #343638 0 73%, #ff741e 73% 100%);
          box-shadow:
            inset 0 0 0 2px rgba(255, 255, 255, 0.10),
            inset 0 0 35px rgba(0,0,0,.65),
            0 18px 38px rgba(0,0,0,.45);
          position: relative;
        }

        .inverter-box::before {
          content: "PowMr";
          position: absolute;
          left: 35px;
          top: 46px;
          color: #ff681b;
          font-weight: 900;
          font-size: 22px;
        }

        .inverter-box::after {
          content: "";
          position: absolute;
          left: 76px;
          top: 124px;
          width: 68px;
          height: 46px;
          border-radius: 5px;
          background:
            radial-gradient(circle at 75% 30%, #ff761f 0 4px, transparent 5px),
            linear-gradient(180deg, #0f1720, #071018);
          border: 1px solid rgba(255,255,255,.22);
          box-shadow: inset 0 0 12px rgba(0, 162, 255, 0.25);
        }

        .temp-row {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 66px;
          display: flex;
          justify-content: space-between;
          z-index: 2;
        }

        .temp {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          color: #bfe4ff;
        }

        .temp ha-icon {
          --mdc-icon-size: 24px;
          color: #ff3b30;
        }

        .mini-status {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          z-index: 2;
        }

        .mini {
          border: 1px solid rgba(130, 180, 210, 0.22);
          border-radius: 6px;
          padding: 8px 10px;
          background: rgba(3, 14, 22, 0.7);
          display: grid;
          gap: 3px;
          text-align: center;
        }

        .mini small {
          color: #bdcbd5;
          font-size: 10px;
        }

        .mini strong {
          color: var(--green);
          font-size: 11px;
        }

        .caravan {
          grid-column: 3;
          grid-row: 1;
        }

        .caravan-body {
          display: grid;
          grid-template-columns: 1fr 92px;
          height: calc(100% - clamp(31px, 3.8vh, 36px));
          min-height: 0;
        }

        .caravan-img {
          display: grid;
          place-items: center;
          padding: 30px 8px 0 8px;
        }

        .caravan-img img {
          max-width: min(170px, 92%);
          max-height: min(145px, 70%);
          object-fit: contain;
          filter: drop-shadow(0 12px 18px rgba(0,0,0,.58));
        }

        .caravan-fallback {
          width: 162px;
          height: 86px;
          border-radius: 25px 13px 12px 12px;
          background: linear-gradient(160deg, #f2f6fb, #8fa1ae);
          clip-path: polygon(11% 10%, 65% 0, 100% 26%, 96% 78%, 8% 86%, 0 48%);
          box-shadow: 0 12px 24px rgba(0,0,0,.5);
        }

        .battery-card {
          grid-column: 2 / span 2;
          grid-row: 2;
          width: min(100%, 520px);
          justify-self: center;
        }

        .battery-body {
          position: relative;
          display: grid;
          grid-template-columns: 95px 1fr 98px;
          align-items: center;
          min-height: 0;
          height: calc(100% - clamp(31px, 3.8vh, 36px));
          padding: 10px 18px 12px;
        }

        .battery-pack {
          position: relative;
          height: clamp(66px, 7.2vh, 82px);
          border-radius: 8px;
          border: 2px solid rgba(230, 245, 255, 0.42);
          background: linear-gradient(180deg, #222, #050708);
          box-shadow: inset 0 0 18px rgba(255,255,255,.1), 0 15px 24px rgba(0,0,0,.35);
          overflow: hidden;
        }

        .battery-fill {
          position: absolute;
          inset: 8px auto 8px 8px;
          width: calc((100% - 16px) * var(--soc) / 100);
          border-radius: 4px;
          background: linear-gradient(90deg, #1fd946, #75ff5f);
          box-shadow: 0 0 24px rgba(52, 255, 74, 0.65);
          transition: width 0.8s ease;
        }

        .battery-soc {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-size: clamp(28px, 2.5vw, 36px);
          font-weight: 900;
          color: #f6fff6;
          text-shadow: 0 0 15px rgba(0,0,0,.7);
        }

        .battery-term {
          position: absolute;
          top: -12px;
          width: 22px;
          height: 18px;
          border-radius: 5px 5px 0 0;
          background: linear-gradient(#f45454, #9c0000);
          left: 24px;
          box-shadow: 190px 0 0 #111;
        }

        .power-negative strong {
          color: #ff7b18;
        }

        .right-rail {
          grid-column: 4;
          grid-row: 1 / span 3;
          display: grid;
          grid-template-rows: minmax(180px, 1.15fr) minmax(122px, 0.74fr) minmax(132px, 0.82fr) minmax(140px, 1fr);
          gap: 10px;
          min-height: 0;
        }

        .chart-card,
        .donut-card,
        .settings-card,
        .temps-card {
          min-height: 0;
        }

        .chart {
          padding: 12px 14px;
          position: relative;
          z-index: 1;
        }

        .chart svg {
          width: 100%;
          height: clamp(96px, 12.5vh, 132px);
          overflow: visible;
        }

        .legend {
          display: flex;
          gap: 13px;
          justify-content: flex-end;
          color: #dceaf4;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .legend span::before {
          content: "";
          display: inline-block;
          width: 13px;
          height: 3px;
          border-radius: 2px;
          margin-right: 5px;
          vertical-align: middle;
          background: currentColor;
        }

        .donut-wrap {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 10px;
          padding: 14px 14px 12px;
          position: relative;
          z-index: 1;
        }

        .donut {
          width: 92px;
          height: 92px;
          border-radius: 50%;
          background:
            radial-gradient(circle, #06121b 0 42%, transparent 43%),
            conic-gradient(var(--blue) 0 34%, var(--orange) 34% 58%, var(--green) 58% 77%, #ff4141 77% 100%);
          box-shadow: inset 0 0 22px rgba(0,0,0,.4), 0 0 22px rgba(0,162,255,.15);
        }

        .donut-list {
          display: grid;
          gap: 6px;
          font-size: 12px;
        }

        .donut-list div {
          display: grid;
          grid-template-columns: 10px 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .swatch {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .list {
          position: relative;
          z-index: 1;
          padding: 9px 13px 12px;
          display: grid;
          gap: 8px;
          font-size: 12px;
        }

        .list-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,.07);
          padding-bottom: 5px;
        }

        .list-row strong {
          color: var(--green);
        }

        .bottom-row {
          grid-column: 1 / span 3;
          grid-row: 3;
          display: grid;
          grid-template-columns: minmax(190px, 0.95fr) minmax(190px, 0.95fr) minmax(230px, 1.08fr) minmax(250px, 1.2fr);
          gap: 12px;
          min-height: 0;
        }

        .mini-chart-card,
        .temps-small,
        .current-gauge,
        .energy-day {
          min-height: 0;
        }

        .temp-grid {
          position: relative;
          z-index: 1;
          padding: 20px 14px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          text-align: center;
          gap: 8px;
        }

        .temp-grid .metric {
          border: 0;
        }

        .gauge {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          height: 126px;
        }

        .gauge-arc {
          width: 180px;
          height: 90px;
          border-radius: 180px 180px 0 0;
          background: conic-gradient(from 270deg at 50% 100%, #ff6b00 0 35deg, #ffd200 35deg 70deg, #16c44b 70deg 180deg, transparent 180deg);
          clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          position: relative;
        }

        .gauge-arc::after {
          content: "";
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: 0;
          height: 66px;
          border-radius: 132px 132px 0 0;
          background: #06121b;
        }

        .gauge-value {
          position: absolute;
          bottom: 20px;
          text-align: center;
        }

        .gauge-value strong {
          display: block;
          color: #ff7b18;
          font-size: 29px;
          line-height: 1;
        }

        .energy-grid {
          position: relative;
          z-index: 1;
          padding: 18px 14px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          text-align: center;
        }

        .energy-item ha-icon {
          --mdc-icon-size: 33px;
          color: #dbefff;
          margin-bottom: 6px;
        }

        .energy-item strong {
          display: block;
          color: var(--blue);
          font-size: 15px;
          margin-top: 3px;
        }

        .flow-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .flow {
          fill: none;
          stroke-width: 6;
          stroke-linecap: round;
          stroke-dasharray: 14 14;
          filter: drop-shadow(0 0 9px currentColor);
          animation: flow 1.05s linear infinite;
        }

        .flow.green { stroke: var(--green); color: var(--green); }
        .flow.blue { stroke: var(--blue); color: var(--blue); }
        .flow.orange { stroke: var(--orange); color: var(--orange); }
        .flow.hidden { display: none; }
        .flow.reverse { animation-direction: reverse; }

        .dash.no-animation .flow {
          animation: none;
        }

        @keyframes flow {
          to { stroke-dashoffset: -56; }
        }

        .view-panel {
          position: absolute;
          inset: clamp(8px, 0.75vw, 14px);
          z-index: 5;
          border: 1px solid rgba(0, 162, 255, 0.38);
          border-radius: 8px;
          background:
            linear-gradient(180deg, rgba(0, 85, 150, 0.22), transparent 46px),
            rgba(2, 10, 16, 0.96);
          box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 0 28px rgba(0, 162, 255, 0.08);
          padding: 14px;
          overflow: auto;
        }

        .view-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
          padding-bottom: 12px;
          margin-bottom: 14px;
        }

        .view-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 800;
        }

        .view-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .view-card {
          border: 1px solid rgba(0, 162, 255, 0.24);
          border-radius: 8px;
          background: rgba(4, 18, 27, 0.72);
          padding: 14px;
          min-height: 116px;
        }

        .view-card h4 {
          margin: 0 0 10px;
          font-size: 13px;
          color: #d9ecf8;
          letter-spacing: 0.4px;
        }

        .view-value {
          color: var(--blue);
          font-size: 28px;
          font-weight: 900;
          line-height: 1.05;
        }

        .view-value.green { color: var(--green); }
        .view-value.orange { color: var(--orange); }
        .view-value.red { color: var(--red); }

        .view-entity {
          color: var(--muted);
          font-size: 11px;
          margin-top: 6px;
          word-break: break-all;
        }

        .footer {
          display: grid;
          grid-template-columns: repeat(7, 1fr) 64px;
          align-items: center;
          gap: 1px;
          border-top: 1px solid rgba(0, 162, 255, 0.24);
          background: rgba(1, 7, 12, 0.62);
          min-height: 0;
        }

        .foot-item {
          height: min(64px, 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-right: 1px solid rgba(255,255,255,.08);
          color: #d7eaf7;
          min-width: 0;
        }

        .foot-item ha-icon {
          --mdc-icon-size: 26px;
          color: #e8f5ff;
        }

        .foot-item small {
          display: block;
          color: #8fa4b4;
          font-size: 10px;
          white-space: nowrap;
        }

        .foot-item strong {
          display: block;
          color: var(--green);
          font-size: 16px;
          white-space: nowrap;
        }

        @media (max-width: 1350px) {
          ha-card {
            overflow: visible;
          }
          .dash {
            height: auto;
            min-height: 0;
            grid-template-columns: 1fr;
            overflow: visible;
          }
          .sidebar {
            display: none;
          }
          .main {
            grid-template-rows: auto 1fr auto;
            overflow: visible;
          }
          .canvas {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto;
            overflow: visible;
          }
          .inverter,
          .caravan,
          .battery-card,
          .right-rail,
          .bottom-row {
            grid-column: auto;
            grid-row: auto;
            width: auto;
          }
          .right-rail,
          .bottom-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: auto;
          }
          .inverter-body,
          .caravan-body,
          .battery-body {
            height: auto;
          }
          .source-art {
            min-height: 210px;
          }
          .flow-layer {
            display: none;
          }
          .view-panel {
            position: relative;
            inset: auto;
          }
          .view-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .footer {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 760px) {
          .topbar {
            grid-template-columns: 1fr;
            gap: 4px;
            padding: 10px 14px;
          }
          .top-meta {
            justify-content: center;
            flex-wrap: wrap;
          }
          .canvas {
            grid-template-columns: 1fr;
          }
          .dash {
            height: auto;
            min-height: 0;
          }
          .right-rail,
          .bottom-row {
            grid-template-columns: 1fr;
          }
          .source-card,
          .caravan-body,
          .battery-body,
          .energy-grid,
          .temp-grid {
            grid-template-columns: 1fr;
          }
          .source-metrics {
            padding: 0 16px 16px;
          }
          .status-pill {
            position: relative;
            left: auto;
            bottom: auto;
            margin: 0 12px 12px;
          }
          .footer {
            grid-template-columns: 1fr;
          }
          .view-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .view-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <ha-card>
        <div class="dash ${animation ? "" : "no-animation"}" style="--card-height:${this.escape(cardHeight)}">
          <aside class="sidebar">
            <div class="brand">
              <div class="tm">TM<span>MODELS</span></div>
              <small>ENERGY SYSTEM</small>
            </div>
            <nav class="nav">
              ${this._nav("overview", "mdi:home-outline", "PANORAMICA", activeView)}
              ${this._nav("energy", "mdi:lightning-bolt-outline", "ENERGIA", activeView)}
              ${this._nav("battery", "mdi:battery-high", "BATTERIA", activeView)}
              ${this._nav("caravan", "mdi:caravan", "CARAVAN", activeView)}
              ${this._nav("temperatures", "mdi:thermometer", "TEMPERATURE", activeView)}
              ${this._nav("settings", "mdi:cog-outline", "IMPOSTAZIONI", activeView)}
              ${this._nav("alarms", "mdi:bell-outline", "ALLARMI", activeView)}
              ${this._nav("log", "mdi:file-document-outline", "LOG SISTEMA", activeView)}
            </nav>
            <div class="side-box">
              <div class="side-title">STATO SISTEMA</div>
              <div class="state-line"><span class="dot"></span>${acActive ? "ON GRID" : "OFF GRID"}</div>
              <div class="state-line"><span class="dot"></span>${alarm ? "ALLARME" : "NORMALE"}</div>
            </div>
            <div class="side-box">
              <div class="side-title">TM MODELS © 2026</div>
              <div class="side-title">Ver. 1.0.0</div>
            </div>
          </aside>

          <main class="main">
            <header class="topbar">
              <div class="title">${this.config.title}</div>
              <div class="top-meta">
                <span><ha-icon icon="mdi:thermometer"></ha-icon> ${this._fmt(e.internalTemp, 1)}</span>
                <span><ha-icon icon="mdi:calendar-month"></ha-icon> ${now.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}</span>
                <span><ha-icon icon="mdi:clock-outline"></ha-icon> ${now.toLocaleTimeString("it-IT")}</span>
                <ha-icon icon="mdi:wifi"></ha-icon>
              </div>
            </header>

            <section class="canvas">
              <svg class="flow-layer" viewBox="0 0 1220 700" preserveAspectRatio="none">
                <path class="flow green ${this._flowClass(Math.abs(gridPower) >= flowThreshold && acActive, gridPower < -flowThreshold)}" d="M190 112 H385" />
                <path class="flow blue ${this._flowClass(pvPower >= flowThreshold)}" d="M190 332 H330 V240 H420" />
                <path class="flow blue ${this._flowClass(Math.abs(loadPower) >= flowThreshold, loadPower < -flowThreshold)}" d="M710 110 H830" />
                <path class="flow orange ${this._flowClass(Math.abs(batteryPower) >= flowThreshold, batteryPower < -flowThreshold)}" d="M565 295 V370" />
              </svg>

              ${this._sourceCard("Rete AC", "mdi:transmission-tower", "tower", [
                ["Potenza", this._fmt(e.gridPower, 0), "green"],
                ["Oggi", this._fmt(e.gridEnergy, 2)],
                ["Tensione", this._fmt(e.gridVoltage, 0)],
                ["Frequenza", this._fmt(e.gridFrequency, 1)],
              ], acActive ? "IN INGRESSO" : "ASSENTE", "green")}

              <section class="card inverter">
                <div class="card-title">INVERTER POWMR HVM12V 2KW</div>
                <div class="inverter-body">
                  <div class="inverter-box"></div>
                  <div class="temp-row">
                    <div class="temp"><ha-icon icon="mdi:thermometer"></ha-icon><span>${this._fmt(e.mpptTemp, 1)}</span></div>
                    <div class="temp"><ha-icon icon="mdi:thermometer"></ha-icon><span>${this._fmt(e.inverterTemp, 1)}</span></div>
                  </div>
                  <div class="mini-status">
                    <div class="mini"><small>MODALITA</small><strong>${acActive ? "ON GRID" : "OFF GRID"}</strong></div>
                    <div class="mini"><small>STATO</small><strong>${alarm ? "ALLARME" : "NORMALE"}</strong></div>
                    <div class="mini"><small>ALLARMI</small><strong>${alarm ? "ATTIVO" : "NESSUNO"}</strong></div>
                  </div>
                </div>
              </section>

              <section class="card caravan">
                <div class="card-title">CARAVAN / USCITA AC</div>
                <div class="caravan-body">
                  <div class="caravan-img">
                    <img src="/local/caravan.png" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
                    <div class="caravan-fallback" style="display:none"></div>
                  </div>
                  <div class="source-metrics">
                    ${this._metric("Potenza", this._fmt(e.loadPower, 0))}
                    ${this._metric("Carico", this._fmt(e.loadPercent, 0))}
                    ${this._metric("Tensione", this._fmt(e.loadVoltage, 0))}
                    ${this._metric("Frequenza", this._fmt(e.loadFrequency, 1))}
                  </div>
                </div>
                ${this._status("IN USCITA", "blue")}
              </section>

              <div style="grid-column:1;grid-row:2">
                ${this._sourceCard("Fotovoltaico", "mdi:solar-panel-large", "solar-panel", [
                  ["Potenza", this._fmt(e.pvPower, 0)],
                  ["Oggi", this._fmt(e.pvEnergy, 2)],
                  ["Tensione", this._fmt(e.pvVoltage, 1)],
                  ["Corrente", this._fmt(e.pvCurrent, 1)],
                ], "IN PRODUZIONE", "blue")}
              </div>

              <section class="card battery-card">
                <div class="card-title">BATTERIA LiFePO4 12V ${capacity}Ah</div>
                <div class="battery-body" style="--soc:${soc}">
                  <div>
                    ${this._metric("Tensione", this._fmt(e.batteryVoltage, 1))}
                    ${this._metric("Temperatura", this._fmt(e.batteryTemp, 1))}
                  </div>
                  <div class="battery-pack">
                    <div class="battery-term"></div>
                    <div class="battery-fill"></div>
                    <div class="battery-soc">${soc.toFixed(0)}%</div>
                  </div>
                  <div class="${batteryPower < 0 ? "power-negative" : ""}">
                    ${this._metric("Corrente batteria", this._fmt(e.batteryCurrent, 1), batteryPower < 0 ? "orange" : "green")}
                    ${this._metric("Potenza", this._fmt(e.batteryPower, 0), batteryPower < 0 ? "orange" : "green")}
                    <div style="color:${batteryPower < 0 ? "var(--orange)" : "var(--green)"};font-size:11px;font-weight:800;text-align:center">${batteryMode}</div>
                  </div>
                </div>
              </section>

              <aside class="right-rail">
                <section class="card chart-card">
                  <div class="card-title">GRAFICO FLUSSI ENERGETICI</div>
                  <div class="chart">
                    <div class="legend">
                      <span style="color:var(--blue)">FV</span>
                      <span style="color:var(--green)">BATTERIA</span>
                      <span style="color:var(--orange)">RETE</span>
                      <span style="color:#ff4141">CARAVAN</span>
                    </div>
                    <svg viewBox="0 0 310 112">
                      <g stroke="rgba(255,255,255,.08)" stroke-width="1">
                        <path d="M0 18 H310M0 46 H310M0 74 H310M0 102 H310"/>
                        <path d="M42 0 V112M124 0 V112M206 0 V112M288 0 V112"/>
                      </g>
                      ${this._spark(sampleSeed, "pv", "#00a2ff")}
                      ${this._spark(sampleSeed, "batt", "#25e04f")}
                      ${this._spark(sampleSeed, "grid", "#ff8a00")}
                      ${this._spark(sampleSeed, "load", "#ff4141")}
                    </svg>
                  </div>
                </section>

                <section class="card donut-card">
                  <div class="card-title">DISTRIBUZIONE ENERGIA OGGI</div>
                  <div class="donut-wrap">
                    <div class="donut"></div>
                    <div class="donut-list">
                      ${this._donut("Fotovoltaico", this._fmt(e.pvEnergy, 2), "var(--blue)")}
                      ${this._donut("Rete", this._fmt(e.gridEnergy, 2), "var(--orange)")}
                      ${this._donut("Batteria", this._fmt(e.batteryEnergy, 1), "var(--green)")}
                      ${this._donut("Caravan", this._fmt(e.loadPower, 0), "#ff4141")}
                    </div>
                  </div>
                </section>

                <section class="card settings-card">
                  <div class="card-title">IMPOSTAZIONI INVERTER</div>
                  <div class="list">
                    ${this._row("Priorita uscita", this._text(e.outputPriority))}
                    ${this._row("Priorita carica", this._text(e.chargerPriority))}
                    ${this._row("Carica rete", this._text(e.utilityCurrent))}
                    ${this._row("Max carica", this._fmt(e.maxChargeCurrent, 0))}
                    ${this._row("Allarme", alarm ? "ATTIVO" : "Nessuno")}
                  </div>
                </section>

                <section class="card temps-card">
                  <div class="card-title">TEMPERATURE CARAVAN</div>
                  <div class="list">
                    ${this._row("Interno", this._fmt(e.internalTemp, 1))}
                    ${this._row("Esterno", this._fmt(e.externalTemp, 1))}
                    ${this._row("Batteria servizi", this._fmt(e.batteryServiceTemp, 1))}
                    ${this._row("Vano tecnico", this._fmt(e.bayTemp, 1))}
                    ${this._row("MPPT", this._fmt(e.mpptTemp, 1))}
                  </div>
                </section>
              </aside>

              <section class="bottom-row">
                <section class="card mini-chart-card">
                  <div class="card-title">PRODUZIONE GIORNALIERA</div>
                  <div class="chart">
                    <svg viewBox="0 0 220 108">
                      <g stroke="rgba(255,255,255,.08)" stroke-width="1"><path d="M0 20H220M0 52H220M0 84H220"/></g>
                      ${this._spark(sampleSeed, "pv", "#00a2ff")}
                    </svg>
                  </div>
                </section>

                <section class="card temps-small">
                  <div class="card-title">TEMPERATURE SISTEMA</div>
                  <div class="temp-grid">
                    ${this._metric("MPPT", this._fmt(e.mpptTemp, 1), "green")}
                    ${this._metric("220V", this._fmt(e.inverterTemp, 1), "green")}
                    ${this._metric("Batteria", this._fmt(e.batteryTemp, 1), "green")}
                  </div>
                </section>

                <section class="card current-gauge">
                  <div class="card-title">CORRENTE BATTERIA</div>
                  <div class="gauge">
                    <div class="gauge-arc"></div>
                    <div class="gauge-value">
                      <strong>${this._fmt(e.batteryCurrent, 1)}</strong>
                      <span>${batteryMode}</span>
                    </div>
                  </div>
                </section>

                <section class="card energy-day">
                  <div class="card-title">ENERGIA GIORNALIERA</div>
                  <div class="energy-grid">
                    ${this._energy("mdi:white-balance-sunny", "Da solare", this._fmt(e.pvEnergy, 2))}
                    ${this._energy("mdi:transmission-tower", "Da rete", this._fmt(e.gridEnergy, 2))}
                    ${this._energy("mdi:battery-high", "Batteria", this._fmt(e.batteryEnergy, 1))}
                    ${this._energy("mdi:caravan", "Caravan", this._fmt(e.loadPower, 0))}
                  </div>
                </section>
              </section>
              ${activeView === "overview" ? "" : this._detailView(activeView, e, { soc, pvPower, gridPower, batteryPower, loadPower, batteryMode, alarm, acActive, flowThreshold })}
            </section>

            <footer class="footer">
              ${this._foot("mdi:battery-high", "Stato batteria", `${soc.toFixed(0)}%`)}
              ${this._foot("mdi:car-battery", "Tensione batteria", this._fmt(e.batteryVoltage, 1))}
              ${this._foot("mdi:current-dc", "Corrente batteria", this._fmt(e.batteryCurrent, 1), batteryPower < 0)}
              ${this._foot("mdi:flash", "Potenza batteria", this._fmt(e.batteryPower, 0), batteryPower < 0)}
              ${this._foot("mdi:counter", "Cicli batteria", this._state(e.batteryCycles))}
              ${this._foot("mdi:battery-clock", "Capacita residua", this._fmt(e.batteryEnergy, 1))}
              ${this._foot("mdi:clock-outline", "Autonomia residua", this._text(e.batteryRuntime))}
              <div class="foot-item"><ha-icon icon="mdi:cog-outline"></ha-icon></div>
            </footer>
          </main>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", (event) => {
        this.activeView = event.currentTarget.dataset.view || "overview";
        this._render();
      });
    });
  }

  _nav(view, icon, label, activeView) {
    const active = view === activeView;
    return `<button class="nav-item ${active ? "active" : ""}" data-view="${view}" type="button"><ha-icon icon="${icon}"></ha-icon><span>${label}</span></button>`;
  }

  _flowClass(active, reverse = false) {
    return `${active ? "" : "hidden"} ${reverse ? "reverse" : ""}`;
  }

  _detailView(view, e, data) {
    const views = {
      energy: {
        icon: "mdi:lightning-bolt-outline",
        title: "Energia",
        subtitle: `Soglia flussi: ${data.flowThreshold} W`,
        cards: [
          ["Fotovoltaico", this._fmt(e.pvPower, 0), e.pvPower, data.pvPower >= data.flowThreshold ? "green" : ""],
          ["Rete AC", this._fmt(e.gridPower, 0), e.gridPower, Math.abs(data.gridPower) >= data.flowThreshold ? "green" : ""],
          ["Caravan / uscita", this._fmt(e.loadPower, 0), e.loadPower, Math.abs(data.loadPower) >= data.flowThreshold ? "green" : ""],
          ["Batteria", this._fmt(e.batteryPower, 0), e.batteryPower, data.batteryPower < 0 ? "orange" : "green"],
          ["FV oggi", this._fmt(e.pvEnergy, 2), e.pvEnergy],
          ["Rete oggi", this._fmt(e.gridEnergy, 2), e.gridEnergy],
        ],
      },
      battery: {
        icon: "mdi:battery-high",
        title: "Batteria",
        subtitle: data.batteryMode,
        cards: [
          ["Stato carica", `${data.soc.toFixed(0)}%`, e.batterySoc, data.soc < 20 ? "red" : "green"],
          ["Tensione", this._fmt(e.batteryVoltage, 1), e.batteryVoltage],
          ["Corrente", this._fmt(e.batteryCurrent, 1), e.batteryCurrent, data.batteryPower < 0 ? "orange" : "green"],
          ["Potenza", this._fmt(e.batteryPower, 0), e.batteryPower, data.batteryPower < 0 ? "orange" : "green"],
          ["Temperatura", this._fmt(e.batteryTemp, 1), e.batteryTemp],
          ["Autonomia residua", this._text(e.batteryRuntime), e.batteryRuntime],
          ["Cicli", this._state(e.batteryCycles), e.batteryCycles],
          ["Capacita residua", this._fmt(e.batteryEnergy, 1), e.batteryEnergy],
        ],
      },
      caravan: {
        icon: "mdi:caravan",
        title: "Caravan",
        subtitle: Math.abs(data.loadPower) >= data.flowThreshold ? "Uscita attiva" : "Uscita senza carico rilevante",
        cards: [
          ["Potenza uscita", this._fmt(e.loadPower, 0), e.loadPower, Math.abs(data.loadPower) >= data.flowThreshold ? "green" : ""],
          ["Percentuale carico", this._fmt(e.loadPercent, 0), e.loadPercent],
          ["Tensione uscita", this._fmt(e.loadVoltage, 0), e.loadVoltage],
          ["Frequenza uscita", this._fmt(e.loadFrequency, 1), e.loadFrequency],
          ["Priorita uscita", this._text(e.outputPriority), e.outputPriority],
          ["Rete AC", data.acActive ? "ON GRID" : "OFF GRID", e.acActive, data.acActive ? "green" : "orange"],
        ],
      },
      temperatures: {
        icon: "mdi:thermometer",
        title: "Temperature",
        subtitle: "Sensori caravan e inverter",
        cards: [
          ["Interno", this._fmt(e.internalTemp, 1), e.internalTemp],
          ["Esterno", this._fmt(e.externalTemp, 1), e.externalTemp],
          ["Batteria servizi", this._fmt(e.batteryServiceTemp, 1), e.batteryServiceTemp],
          ["Vano tecnico", this._fmt(e.bayTemp, 1), e.bayTemp],
          ["MPPT", this._fmt(e.mpptTemp, 1), e.mpptTemp],
          ["Inverter 220V", this._fmt(e.inverterTemp, 1), e.inverterTemp],
          ["Batteria", this._fmt(e.batteryTemp, 1), e.batteryTemp],
        ],
      },
      settings: {
        icon: "mdi:cog-outline",
        title: "Impostazioni",
        subtitle: "Stati configurabili dell'inverter",
        cards: [
          ["Priorita uscita", this._text(e.outputPriority), e.outputPriority],
          ["Priorita carica", this._text(e.chargerPriority), e.chargerPriority],
          ["Corrente carica rete", this._text(e.utilityCurrent), e.utilityCurrent],
          ["Corrente massima carica", this._fmt(e.maxChargeCurrent, 0), e.maxChargeCurrent],
          ["Animazioni flussi", this.config.animation === false ? "Disattivate" : "Attive", "animation"],
          ["Soglia flussi", `${data.flowThreshold} W`, "flow_threshold_w"],
        ],
      },
      alarms: {
        icon: "mdi:bell-outline",
        title: "Allarmi",
        subtitle: data.alarm ? "Allarme attivo" : "Nessun allarme attivo",
        cards: [
          ["Stato allarme", data.alarm ? "ATTIVO" : "NESSUNO", e.alarm, data.alarm ? "red" : "green"],
          ["Stato inverter", data.alarm ? "ALLARME" : "NORMALE", e.alarm, data.alarm ? "red" : "green"],
          ["Rete AC", data.acActive ? "Presente" : "Assente", e.acActive, data.acActive ? "green" : "orange"],
          ["Batteria", data.batteryMode, e.batteryPower, data.batteryPower < 0 ? "orange" : "green"],
        ],
      },
      log: {
        icon: "mdi:file-document-outline",
        title: "Log Sistema",
        subtitle: "Ultimi campioni raccolti dalla card",
        cards: [
          ["Campioni grafico", String(this.samples.length), "internal.samples"],
          ["Ultimo FV", this._fmt(e.pvPower, 0), e.pvPower],
          ["Ultima rete", this._fmt(e.gridPower, 0), e.gridPower],
          ["Ultima batteria", this._fmt(e.batteryPower, 0), e.batteryPower],
          ["Ultimo carico", this._fmt(e.loadPower, 0), e.loadPower],
          ["Versione card", CARD_VERSION, "caravan-energy-card"],
        ],
      },
    };

    const detail = views[view] || views.energy;
    return `
      <section class="view-panel">
        <div class="view-head">
          <div class="view-title"><ha-icon icon="${detail.icon}"></ha-icon>${detail.title}</div>
          <div class="side-title">${detail.subtitle}</div>
        </div>
        <div class="view-grid">
          ${detail.cards.map(([label, value, entity, tone]) => this._viewCard(label, value, entity, tone)).join("")}
        </div>
      </section>
    `;
  }

  _viewCard(label, value, entity, tone = "") {
    return `
      <div class="view-card">
        <h4>${label}</h4>
        <div class="view-value ${tone}">${value}</div>
        <div class="view-entity">${entity}</div>
      </div>
    `;
  }

  _metric(label, value, tone = "") {
    return `<div class="metric ${tone}"><small>${label.toUpperCase()}</small><strong>${value}</strong></div>`;
  }

  _status(label, tone) {
    return `<div class="status-pill"><small>STATO</small><strong><span class="dot" style="color:var(--${tone});background:var(--${tone})"></span>${label}</strong></div>`;
  }

  _sourceCard(title, icon, artClass, metrics, status, tone) {
    return `
      <section class="card source-card">
        <div class="card-title" style="grid-column:1 / -1"><ha-icon icon="${icon}"></ha-icon>${title.toUpperCase()}</div>
        <div class="source-art"><div class="${artClass}"></div></div>
        <div class="source-metrics">
          ${metrics.map(([label, value, metricTone]) => this._metric(label, value, metricTone || "")).join("")}
        </div>
        ${this._status(status, tone)}
      </section>
    `;
  }

  _row(label, value) {
    return `<div class="list-row"><span>${label}</span><strong>${value}</strong></div>`;
  }

  _donut(label, value, color) {
    return `<div style="color:${color}"><span class="swatch"></span><span>${label}</span><strong>${value}</strong></div>`;
  }

  _energy(icon, label, value) {
    return `<div class="energy-item"><ha-icon icon="${icon}"></ha-icon><small>${label}</small><strong>${value}</strong></div>`;
  }

  _foot(icon, label, value, warn = false) {
    return `<div class="foot-item"><ha-icon icon="${icon}"></ha-icon><div><small>${label}</small><strong style="color:${warn ? "var(--orange)" : "var(--green)"}">${value}</strong></div></div>`;
  }
}

class CaravanEnergyCardEditor extends HTMLElement {
  setConfig(config) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      entities: {
        ...(config?.entities || {}),
      },
    };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  emitConfigChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: this.config },
    }));
  }

  updateRootValue(key, value) {
    const parsed = ["capacity_ah", "flow_threshold_w"].includes(key) ? Number(value) : value;
    this.config = { ...this.config, [key]: parsed };
    this.emitConfigChanged();
  }

  updateEntity(key, value) {
    const entities = { ...(this.config.entities || {}) };
    if (value) entities[key] = value;
    else delete entities[key];
    this.config = { ...this.config, entities };
    this.emitConfigChanged();
  }

  render() {
    if (!this.shadowRoot || !this.config) return;
    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: grid;
          gap: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        label {
          display: grid;
          gap: 5px;
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        input {
          width: 100%;
          height: 40px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 0 10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font: inherit;
        }

        ha-entity-picker {
          width: 100%;
        }

        .switch {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--divider-color);
          border-bottom: 1px solid var(--divider-color);
          padding: 10px 0;
        }

        h3 {
          margin: 4px 0 0;
          font-size: 14px;
        }

        @media (max-width: 720px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="editor">
        <div class="grid">
          <label>
            Titolo plancia
            <input data-root="title" value="${this.escape(this.config.title || "")}">
          </label>
          <label>
            Capacita batteria Ah
            <input data-root="capacity_ah" type="number" min="1" value="${Number(this.config.capacity_ah) || 140}">
          </label>
          <label>
            Altezza plancia CSS
            <input data-root="height" value="${this.escape(this.config.height || DEFAULT_CONFIG.height)}">
          </label>
          <label>
            Soglia flussi W
            <input data-root="flow_threshold_w" type="number" min="0" value="${Number(this.config.flow_threshold_w) || DEFAULT_CONFIG.flow_threshold_w}">
          </label>
        </div>

        <div class="switch">
          <span>Animazioni flussi</span>
          <ha-switch data-root="animation"></ha-switch>
        </div>

        <h3>Entita</h3>
        <div class="grid">
          ${ENTITY_FIELDS.map(([key, label]) => this.entityPicker(key, label)).join("")}
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("input[data-root]").forEach((input) => {
      input.addEventListener("change", (event) => {
        this.updateRootValue(event.currentTarget.dataset.root, event.currentTarget.value);
      });
    });

    const animationSwitch = this.shadowRoot.querySelector('ha-switch[data-root="animation"]');
    if (animationSwitch) {
      animationSwitch.checked = this.config.animation !== false;
      animationSwitch.addEventListener("change", (event) => {
        this.updateRootValue("animation", event.currentTarget.checked);
      });
    }

    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const field = ENTITY_FIELDS.find(([key]) => key === picker.dataset.entityKey);
      picker.hass = this._hass;
      picker.includeDomains = field?.[2] || [];
      picker.addEventListener("value-changed", (event) => {
        this.updateEntity(event.currentTarget.dataset.entityKey, event.detail.value);
      });
    });
  }

  entityPicker(key, label) {
    const value = this.config.entities?.[key] || "";
    return `
      <label>
        ${label}
        <ha-entity-picker
          data-entity-key="${key}"
          value="${this.escape(value)}"
          allow-custom-entity>
        </ha-entity-picker>
      </label>
    `;
  }

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char]));
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, CaravanEnergyCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, CaravanEnergyCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Caravan Energy Card",
  description: "Plancia energetica cockpit per caravan, batteria, fotovoltaico, rete e inverter.",
  preview: true,
  documentationURL: "https://github.com/mistermif/caravan-energy-card",
});

console.info(
  `%c ${CARD_TAG} %c v${CARD_VERSION} `,
  "color: white; background: #03a9ff; font-weight: 700;",
  "color: #03a9ff; background: transparent; font-weight: 700;"
);
