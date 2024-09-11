import { MciProTableSchema } from "./mci-protable/types";

export default {
  service: {
    query: {
      serviceName: "postAssetRiskWorkOrderManage_mciAggregatesService",
      paramPreprocessor: function (params: any) {
        const { current, pageSize } = params;
        params.page = current;
        params.size = pageSize;

        delete params.current;
        delete params.pageSize;

        return params;
      },
      transformer: function (res: any) {
        return {
          data: res.data.content,
          success: res.code === "0000",
          total: res.data.page.totalElements,
        };
      },
    },
    // export: {
    //   serviceName: 'postAdminV1DroExport_mcexpOperation',
    // },
  },
  columnSetting: [
    {
      title: "序号",
      dataIndex: "index",
      valueType: "indexBorder",
      width: 48,
    },
    {
      title: "关键字搜索",
      dataIndex: "keyWord",
      valueType: "text",
      fieldProps: {
        placeholder: "搜索品牌、节点企业、资产管理人",
      },
      hideInTable: true,
    },
    {
      title: "品牌名称",
      dataIndex: "brand",
      valueType: "text",
      hideInSearch: true,
      width: 100,
      // ellipsis: true,
    },
    {
      title: "节点企业名称",
      dataIndex: "entName",
      valueType: "text",
      hideInSearch: true,
      width: 100,
    },
    {
      title: "资产负责人",
      dataIndex: "assetManageUserName",
      valueType: "text",
      hideInSearch: true,
      width: 100,
    },
    {
      title: "涉及风险/总门店数",
      hideInSearch: true,
      // cellRenderer: "TotalRisk",
      width: 100,
    },
    {
      title: "待处理/总待办数",
      hideInSearch: true,
      // cellRenderer: "TotalProcessing",
      width: 100,
    },
    {
      title: "行业/业态/品类",
      dataIndex: "categoryName",
      valueType: "text",
      hideInSearch: true,
      width: 100,
    },
    {
      title: "更新日期",
      dataIndex: "modifyDate",
      valueType: "text",
      hideInSearch: true,
      width: 100,
    },
    // {
    //   title: "操作",
    //   dataIndex: "__action__",
    //   valueType: "option",
    //   width: 80,
    //   actions: [
    //     // {
    //     //   key: "ViewOrder",
    //     //   nameRenderer: "ViewOrder",
    //     // },
    //   ],
    // },
  ],
  // toolBarActions: ["AddAttache"],
  tableSetting: {
    pageSize: 10,
    title: "待办管理列表",
    // TODO: 这个看如果可以不要配置，自动根据列数量决定
    // scrollX: 3200,
    rowKey: "ccaId",
  },
} as MciProTableSchema;
