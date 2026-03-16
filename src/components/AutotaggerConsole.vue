<script setup lang="ts">
import { onActivated, onDeactivated, ref } from "vue";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

const emit = defineEmits<{
    (e: "resize", columns: number, rows: number): void;
}>();

const wrapper = ref<HTMLElement | null>(null);
const container = ref<HTMLElement | null>(null);

const terminal = new Terminal({
    fontFamily: "Consolas, Menlo, monospace",
    fontSize: 14,
    lineHeight: 1.2,
    theme: {
        background: "#0f1115"
    }
});

terminal.attachCustomKeyEventHandler((event) => {
    if (event.ctrlKey && event.key === "c")
        return false;

    return true;
});

const fit = new FitAddon();
terminal.loadAddon(fit);

const handleResize = () => {
    fit.fit();
    emit("resize", terminal.cols, terminal.rows);
}
const write = (line: string) => terminal.write(line);

let resizeObserver: ResizeObserver | null = null;

onActivated(async () => {
    if (!container.value)
        return;

    terminal.open(container.value);

    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(wrapper.value!);
});

onDeactivated(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
});

defineExpose({ write });
</script>

<template>
    <div ref="wrapper" class="h-full w-full overflow-hidden rounded-box border-base-300 bg-[#0f1115] p-3">
        <div ref="container" class="h-full w-full"></div>
    </div>
</template>
