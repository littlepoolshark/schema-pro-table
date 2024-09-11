import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { MciRootProProvider } from "./config-provider/mci";
import MciProTable from "./mci-protable";
import schema from "./schema";
import CustomValueType from "./custom-value-type";

function App() {
  // return (
  //   <MciRootProProvider apiMap={{}}>
  //     {/*
  //     //@ts-ignore */}
  //     <MciProTable {...schema} />
  //   </MciRootProProvider>
  // );
  return <CustomValueType />;
}

export default App;
