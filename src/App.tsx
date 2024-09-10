import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { MciRootProProvider } from "./config-provider/mci";
import MciProTable from "./mci-protable";
import schema from "./schema";

function App() {
  return (
    <MciRootProProvider apiMap={{}}>
      {/* 
      //@ts-ignore */}
      <MciProTable {...schema} />
    </MciRootProProvider>
  );
}

export default App;
