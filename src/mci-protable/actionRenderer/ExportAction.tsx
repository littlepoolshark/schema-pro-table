import { createElement, useState } from 'react';
import { Button } from 'antd';
import type { AxiosResponse } from 'axios';
import type { MciProtableContext } from '../types';
import { extractHttpMethodFromServiceName } from '../utils';

function validateContentDisposition(contentDispositionHeader) {
  const regex = /^.*?\bfilename=(["'])(.*?)\1.*$/;
  return regex.test(contentDispositionHeader);
}

function getDownloadFileName(contentDispositionHeader: string) {
  contentDispositionHeader = decodeURIComponent(contentDispositionHeader);
  // 如果后端返回的值不符合规范，前端开发者要敦促后端开发者去修正。尽管，代码上还是尝试去提取一个 filename
  if (!validateContentDisposition(contentDispositionHeader)) {
    console.warn(
      '后端返回的 content-disposition header 的值不符合规范 -  必须要有 filename 字段，且filename的值必须使用单引号或者双引号包住',
    );
  }
  // 正则表达式匹配 'filename' 或 'filename*' 属性后的文件名
  // 这个正则表达式现在也匹配没有引号的文件名
  const regex = /filename[*]?=(?:["']([^"']*)["']|([^"']+))/i;
  const match = contentDispositionHeader.match(regex);

  let fileName = '';

  // 如果正则表达式匹配成功，返回文件名
  if (match) {
    // 返回第一个捕获组匹配的文件名，这将覆盖引号和非引号的情况
    fileName = match[1] || match[2];
  }

  if (typeof fileName === 'string') {
    // 兼容后端返回 header 形如 “attachment;filename=/application/1718850422936conditions.xlsx” 的情况
    if (fileName.includes('/')) {
      const segments = fileName.split('/');
      fileName = segments[segments.length - 1];
    }
  }

  return fileName;
}

export function ExportAction({ apiMap, searchForm, serviceName }: MciProtableContext & { serviceName: string }) {
  const [loading, setLoading] = useState(false);

  const { page, size, ...restForm } = searchForm;
  const httpMethod = extractHttpMethodFromServiceName(serviceName);

  return (
    <Button
      loading={loading}
      onClick={async () => {
        setLoading(true);
        apiMap[serviceName]({
          [httpMethod === 'get' ? 'queryParams' : 'requestBody']: restForm,
          configOverride: {
            responseType: 'blob',
          },
        })
          .then((response: AxiosResponse) => {
            const fileName = getDownloadFileName(
              response.headers['content-disposition'] || response.headers['Content-Disposition'],
            );

            // 处理成功的响应
            const blob = new Blob([response.data]);
            const downloadUrl = window.URL.createObjectURL(blob);

            // 创建隐藏的可下载链接
            const link = document.createElement('a');
            link.href = downloadUrl;
            // TODO: 最好还要支持用户自定义下载文件名
            link.download = fileName || `导出的数据-${Date.now()}.xlsx`; // 设置你想要的文件名
            document.body.appendChild(link); // 必须将链接元素添加到DOM树中

            // 触发点击
            link.click();

            // 下载完成后清理
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(link);
            setLoading(false);
          })
          .catch((error) => {
            setLoading(false);
            console.error('Error while downloading file:', error);
          });
      }}>
      导出
    </Button>
  );
}
