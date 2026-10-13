export type Locale = 'zh-CN' | 'en';

export interface Translations {
  // Navigation & Header
  appTitle: string;
  scriptMode: string;
  editorTab: string;
  batchTab: string;
  openSidebar: string;
  closeSidebar: string;
  languageLabel: string;

  // Sidebar
  sidebarTitle: string;
  sidebarEditor: string;
  sidebarBatch: string;
  sidebarDeps: string;
  donateAuthor: string;
  supportAuthorTitle: string;
  supportAuthorDesc: string;

  // Banner
  bannerTitle: string;
  bannerSubtitle: string;

  // Options Bar
  rubyModeLabel: string;
  properNounGlossary: string;
  hiragana: string;
  katakana: string;
  romaji: string;
  typographySettings: string;
  bodyFontSize: string;
  rubyFontSize: string;
  lineSpacing: string;

  // Dictionary Status
  dictReady: string;
  dictDegraded: string;
  dictLoading: string;
  dictErrorAlert: string;
  reloadDict: string;

  // Editor Pane
  scriptTitleLabel: string;
  scriptTitlePlaceholder: string;
  importTextButton: string;
  importTextTitle: string;
  clearButton: string;
  inputPlaceholder: string;
  readingScriptProgress: string;

  // Preview Pane
  previewTitle: string;
  linesCount: string;
  previewTip: string;
  annotatingProgress: string;
  annotationComplete: string;
  fallbackModeNote: string;
  annotationFailed: string;
  reviewFailed: string;
  autoSource: string;
  glossarySource: string;
  learnedSource: string;
  originalSource: string;
  manualSource: string;
  needsReviewBadge: string;
  readingRecordsLoading: string;
  learnedContextsBadge: string;
  resetScriptCorrections: string;
  missingReadingsAlert: string;
  suppressedReadingsNote: string;
  prevPage: string;
  nextPage: string;
  previewPageInfo: string;

  // Export Bar
  singleExportTitle: string;
  singleExportDesc: string;
  exportTxt: string;
  exportSrt: string;
  exportDocx: string;

  // Batch Panel
  batchTitle: string;
  batchDesc: string;
  targetExportFormat: string;
  dragDropPrompt: string;
  dragDropSupport: string;
  selectFiles: string;
  pendingQueue: string;
  clearQueue: string;
  waiting: string;
  processing: string;
  success: string;
  failed: string;
  startBatchProcessing: string;
  batchProcessingInProgress: string;

  // Modals
  // Dependencies Modal
  depModalTitle: string;
  depModalDesc: string;
  depStatusReady: string;
  depStatusError: string;
  depStatusChecking: string;
  depRecheck: string;
  done: string;
  confirm: string;
  cancel: string;
  save: string;
  delete: string;

  // Export Progress Modal
  exportModalProcessing: string;
  exportModalCancelled: string;
  exportModalFailed: string;
  exportModalDownload: string;
  exportModalDone: string;
  generatingProgress: string;
  generatingFile: string;
  waitingForSave: string;
  fileSaved: string;
  downloadHandedOver: string;
  saveCancelled: string;

  // Batch Done Modal
  batchDoneTitle: string;
  totalFiles: string;
  successExport: string;
  cancelledSave: string;
  exportedFilesLabel: string;
  batchDoneNotice: string;

  // Ruby Correction Modal
  rubyModalTitle: string;
  currentCharLabel: string;
  currentRubyLabel: string;
  noRuby: string;
  contextSentenceLabel: string;
  rubyRangeLabel: string;
  extendLeft: string;
  extendRight: string;
  shrinkRange: string;
  rubyRangeTip: string;
  frequentCandidates: string;
  addToGlossaryCheckbox: string;
  customRubyInputLabel: string;
  customRubyInputPlaceholder: string;
  clearRubyButton: string;
  saveAndNextButton: string;

  // Learned Readings Modal
  learnedModalTitle: string;
  learnedModalDesc: string;
  noLearnedRecords: string;
  contextPrefix: string;

  // Glossary Modal
  glossaryModalTitle: string;
  glossaryModalDesc: string;
  importGlossaryButton: string;
  exportGlossaryButton: string;
  editEntryLegend: string;
  addEntryLegend: string;
  sourceTextLabel: string;
  sourceTextPlaceholder: string;
  readingLabel: string;
  readingPlaceholder: string;
  readingFormatLabel: string;
  romajiFormatOption: string;
  saveEntryButton: string;
  cancelEditButton: string;
  searchEntryLabel: string;
  searchEntryPlaceholder: string;
  entryCountSummary: string;
  editButton: string;
  deleteButton: string;
  glossaryUpdatedNotice: string;
  glossaryImportInvalid: string;
  glossaryImportSuccess: string;
  glossaryImportFailed: string;
  glossaryExportSuccess: string;
  glossaryExportCancelled: string;
  glossaryExportFailed: string;
}

export const translations: Record<Locale, Translations> = {
  'zh-CN': {
    appTitle: 'Furigana Dubbing Studio',
    scriptMode: '台本模式',
    editorTab: '📝 台本编辑器',
    batchTab: '📁 批量处理中心',
    openSidebar: '打开侧边栏',
    closeSidebar: '关闭侧边栏',
    languageLabel: '语言 / Language',

    sidebarTitle: '假名标注工具',
    sidebarEditor: '台本在线编辑器',
    sidebarBatch: '批量文件处理中心',
    sidebarDeps: '依赖诊断与修复',
    donateAuthor: '打赏作者',
    supportAuthorTitle: '🧀 支持作者',
    supportAuthorDesc: '为作者集齐芝士碎片',

    bannerTitle: '日语假名配音台本处理系统',
    bannerSubtitle: '专业高信息密度工作台 • 默认小四字体 (16px) • 高精度上下文消歧注音',

    rubyModeLabel: '注音模式:',
    properNounGlossary: '专名词典',
    hiragana: '平假名',
    katakana: '片假名',
    romaji: '罗马音',
    typographySettings: '排版设置 ▾',
    bodyFontSize: '正文字号:',
    rubyFontSize: '假名字号:',
    lineSpacing: '行间距:',

    dictReady: '离线词典与上下文规则已启用',
    dictDegraded: '基础词表（未加载离线词典）',
    dictLoading: '正在加载离线词典...',
    dictErrorAlert: '离线词典加载失败，当前基础词表可能漏注或误注。请重新加载词典后检查读音。',
    reloadDict: '重新加载',

    scriptTitleLabel: '📝 台本标题:',
    scriptTitlePlaceholder: '输入台本标题（用于 Word 导出标题）',
    importTextButton: '📂 导入文本',
    importTextTitle: '导入 .txt, .srt 或 .docx 文件，将自动将标题设置为文件名',
    clearButton: '清空',
    inputPlaceholder: '请输入日语台本或点击上方「导入文本」...',
    readingScriptProgress: '正在读取台本…',

    previewTitle: '实时假名注音与排版预览',
    linesCount: '行',
    previewTip: '点击汉字修改读音；可扩展标注范围，设置词组整体注音。已有 Word 注音会保留。',
    annotatingProgress: '正在注音',
    annotationComplete: '注音已完成，可校对和导出',
    fallbackModeNote: '当前使用分块兼容模式',
    annotationFailed: '注音失败：',
    reviewFailed: '复核跳转失败：',
    autoSource: '自动',
    glossarySource: '专名词典',
    learnedSource: '语境学习',
    originalSource: '源文件',
    manualSource: '人工确认',
    needsReviewBadge: '待复核',
    readingRecordsLoading: '正在读取校对记录...',
    learnedContextsBadge: '已学语境',
    resetScriptCorrections: '重置此台本校对',
    missingReadingsAlert: '处汉字缺少读音，可点击补充。',
    suppressedReadingsNote: '包含人工选择不注音的文字，不计入缺失读音。',
    prevPage: '上一页',
    nextPage: '下一页',
    previewPageInfo: '预览第',

    singleExportTitle: '单文件导出',
    singleExportDesc: '导出以「{title}」命名的 Word (.docx)、SRT 字幕与 TXT 文本',
    exportTxt: '导出 TXT',
    exportSrt: '导出 SRT',
    exportDocx: '导出 Word (.docx)',

    batchTitle: '台本批量注音与导出',
    batchDesc: '拖拽或选择多个台本文件（支持 .txt, .srt, .docx），系统将根据各自文件名自动生成 Word 标题并注音导出。',
    targetExportFormat: '目标导出格式：',
    dragDropPrompt: '将台本文件拖拽至此处，或点击下方按钮选择',
    dragDropSupport: '支持格式：.txt / .srt / .docx（批量注音时以原文件名作为 Word 标题）',
    selectFiles: '选择文件...',
    pendingQueue: '待处理队列',
    clearQueue: '清空列表',
    waiting: '等待中',
    processing: '注音处理中',
    success: '已成功',
    failed: '失败',
    startBatchProcessing: '开始批量处理并自动保存',
    batchProcessingInProgress: '正在处理队列...',

    depModalTitle: '🛠️ 本地核心组件诊断',
    depModalDesc: '检查当前实际使用的离线词典和校对记录存储状态',
    depStatusReady: '正常',
    depStatusError: '异常',
    depStatusChecking: '检查中...',
    depRecheck: '🔄 重新检查',
    done: '完成',
    confirm: '确定',
    cancel: '取消',
    save: '保存修改',
    delete: '删除',

    exportModalProcessing: '正在导出台本',
    exportModalCancelled: '已取消保存',
    exportModalFailed: '导出失败',
    exportModalDownload: '已发起下载',
    exportModalDone: '导出完成',
    generatingProgress: '生成进度',
    generatingFile: '正在生成 {format} 文件...',
    waitingForSave: '请选择保存位置并等待写入完成...',
    fileSaved: '文件已保存。',
    downloadHandedOver: '已交给浏览器下载，请在下载列表中确认结果。',
    saveCancelled: '已取消保存，可以关闭后重新导出。',

    batchDoneTitle: '✅ 批量处理完成',
    totalFiles: '总文件数',
    successExport: '成功导出',
    cancelledSave: '取消保存',
    exportedFilesLabel: '已导出文件：',
    batchDoneNotice: '已完成 {count} 个文件的保存或下载请求；浏览器下载请在下载列表中确认。',

    rubyModalTitle: '✏️ 假名标注与多音字校对',
    currentCharLabel: '当前标注文字',
    currentRubyLabel: '当前注音',
    noRuby: '(无注音)',
    contextSentenceLabel: '所在短句：',
    rubyRangeLabel: '标注范围（词组共享一组居中注音）：',
    extendLeft: '向左扩展',
    extendRight: '向右扩展',
    shrinkRange: '缩小范围',
    rubyRangeTip: '例如选择「二」后向右扩展至「二人」，输入「ふたり」并保存。修改按台本 ID 保存，改标题不会丢失；仅应用于相同原文行。',
    frequentCandidates: '💡 前后文常见候选读音（点击直接套用）：',
    addToGlossaryCheckbox: '加入专名词典，应用于所有台本的同名文字',
    customRubyInputLabel: '自定义注音 (平假名/片假名/罗马音)：',
    customRubyInputPlaceholder: '输入该语境下的准确假名...',
    clearRubyButton: '清除所选文字注音',
    saveAndNextButton: '保存并下一处',

    learnedModalTitle: '📚 本台本语境已学读音',
    learnedModalDesc: '在复核时确认的读音会自动学习所在短句语境。同一台本中处于相同前后文的词语将自动应用，无需重复复核。',
    noLearnedRecords: '暂无已学语境记录',
    contextPrefix: '语境：',

    glossaryModalTitle: '专名词典',
    glossaryModalDesc: '人名、地名和作品专名在所有台本中复用。按原文精确匹配，长词优先；Word 原注音和单处人工校对优先于词典。',
    importGlossaryButton: '导入词典',
    exportGlossaryButton: '导出词典',
    editEntryLegend: '编辑条目',
    addEntryLegend: '添加条目',
    sourceTextLabel: '原文',
    sourceTextPlaceholder: '例如：小日向',
    readingLabel: '读音',
    readingPlaceholder: '例如：こひなた',
    readingFormatLabel: '读音格式',
    romajiFormatOption: '罗马音（其他模式也保留原样）',
    saveEntryButton: '保存条目',
    cancelEditButton: '取消编辑',
    searchEntryLabel: '查找条目',
    searchEntryPlaceholder: '按原文或读音搜索',
    entryCountSummary: '共 {total} 个条目，当前匹配 {visible} 个。',
    editButton: '编辑',
    deleteButton: '删除',
    glossaryUpdatedNotice: '词典已更新，将应用于所有台本。',
    glossaryImportInvalid: '请导入本工具导出的专名词典 JSON',
    glossaryImportSuccess: '导入 {count} 个条目；同名条目保留当前读音。',
    glossaryImportFailed: '导入失败：',
    glossaryExportSuccess: '词典已导出。',
    glossaryExportCancelled: '已取消导出。',
    glossaryExportFailed: '导出失败：',
  },
  'en': {
    appTitle: 'Furigana Dubbing Studio',
    scriptMode: 'Script Mode',
    editorTab: '📝 Script Editor',
    batchTab: '📁 Batch Center',
    openSidebar: 'Open sidebar',
    closeSidebar: 'Close sidebar',
    languageLabel: 'Language / 语言',

    sidebarTitle: 'Furigana Studio',
    sidebarEditor: 'Online Script Editor',
    sidebarBatch: 'Batch File Processing',
    sidebarDeps: 'Diagnostics & Repair',
    donateAuthor: 'Support Author',
    supportAuthorTitle: '🧀 Support Author',
    supportAuthorDesc: 'Collect cheese slices for the creator',

    bannerTitle: 'Japanese Furigana Dubbing Studio',
    bannerSubtitle: 'High-density workbench • 16px standard font • Context-aware reading disambiguation',

    rubyModeLabel: 'Ruby Type:',
    properNounGlossary: 'Glossary',
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    romaji: 'Romaji',
    typographySettings: 'Typography ▾',
    bodyFontSize: 'Font Size:',
    rubyFontSize: 'Ruby Size:',
    lineSpacing: 'Line Spacing:',

    dictReady: 'Offline dictionary and context rules active',
    dictDegraded: 'Basic lexicon (offline dictionary not loaded)',
    dictLoading: 'Loading offline dictionary...',
    dictErrorAlert: 'Failed to load offline dictionary. Missing or fallback readings may occur. Please reload dictionary.',
    reloadDict: 'Reload',

    scriptTitleLabel: '📝 Title:',
    scriptTitlePlaceholder: 'Script title (used as Word document title)',
    importTextButton: '📂 Import File',
    importTextTitle: 'Import .txt, .srt or .docx file (sets document title from filename)',
    clearButton: 'Clear',
    inputPlaceholder: 'Enter Japanese script text or click "Import File" above...',
    readingScriptProgress: 'Reading script file...',

    previewTitle: 'Live Furigana & Typesetting Preview',
    linesCount: 'lines',
    previewTip: 'Click Kanji to adjust readings or expand compound bounds. Preserves original Word ruby.',
    annotatingProgress: 'Annotating',
    annotationComplete: 'Annotation complete. Ready for review and export.',
    fallbackModeNote: 'Running in chunked compatibility mode',
    annotationFailed: 'Annotation error: ',
    reviewFailed: 'Review jump failed: ',
    autoSource: 'Auto',
    glossarySource: 'Glossary',
    learnedSource: 'Learned',
    originalSource: 'Original',
    manualSource: 'Manual',
    needsReviewBadge: 'Review',
    readingRecordsLoading: 'Loading corrections database...',
    learnedContextsBadge: 'Learned Contexts',
    resetScriptCorrections: 'Reset script corrections',
    missingReadingsAlert: ' kanji lack readings. Click to provide annotations.',
    suppressedReadingsNote: 'Includes tokens manually chosen without ruby.',
    prevPage: 'Prev Page',
    nextPage: 'Next Page',
    previewPageInfo: 'Preview lines',

    singleExportTitle: 'Single File Export',
    singleExportDesc: 'Export "{title}" to Word (.docx), SRT subtitles or plain TXT',
    exportTxt: 'Export TXT',
    exportSrt: 'Export SRT',
    exportDocx: 'Export Word (.docx)',

    batchTitle: 'Batch Furigana Processing',
    batchDesc: 'Drop or select multiple script files (.txt, .srt, .docx) to batch annotate and export using filenames as titles.',
    targetExportFormat: 'Target Format:',
    dragDropPrompt: 'Drag & drop script files here, or click to browse',
    dragDropSupport: 'Supported: .txt / .srt / .docx (uses file name as Word title)',
    selectFiles: 'Select Files...',
    pendingQueue: 'Pending Queue',
    clearQueue: 'Clear Queue',
    waiting: 'Pending',
    processing: 'Processing',
    success: 'Done',
    failed: 'Failed',
    startBatchProcessing: 'Start Batch & Auto-Save',
    batchProcessingInProgress: 'Processing Queue...',

    depModalTitle: '🛠️ Core Component Diagnostics',
    depModalDesc: 'Inspect the status of offline dictionary and persistent correction storage',
    depStatusReady: 'Ready',
    depStatusError: 'Error',
    depStatusChecking: 'Checking...',
    depRecheck: '🔄 Re-check',
    done: 'Done',
    confirm: 'OK',
    cancel: 'Cancel',
    save: 'Save Changes',
    delete: 'Delete',

    exportModalProcessing: 'Exporting Script',
    exportModalCancelled: 'Save Cancelled',
    exportModalFailed: 'Export Failed',
    exportModalDownload: 'Download Started',
    exportModalDone: 'Export Complete',
    generatingProgress: 'Progress',
    generatingFile: 'Generating {format} file...',
    waitingForSave: 'Please choose destination and wait for writing to finish...',
    fileSaved: 'File saved successfully.',
    downloadHandedOver: 'Passed to browser downloads. Check your browser download tray.',
    saveCancelled: 'File save was cancelled. You can reopen and export anytime.',

    batchDoneTitle: '✅ Batch Processing Finished',
    totalFiles: 'Total Files',
    successExport: 'Exported',
    cancelledSave: 'Cancelled',
    exportedFilesLabel: 'Exported Files:',
    batchDoneNotice: 'Completed {count} file save or download requests. Please check browser downloads if prompted.',

    rubyModalTitle: '✏️ Furigana & Reading Review',
    currentCharLabel: 'Selected Text',
    currentRubyLabel: 'Current Ruby',
    noRuby: '(No ruby)',
    contextSentenceLabel: 'Context Clause:',
    rubyRangeLabel: 'Span (Tokens share centered ruby):',
    extendLeft: 'Extend Left',
    extendRight: 'Extend Right',
    shrinkRange: 'Shrink',
    rubyRangeTip: 'e.g. Select "二" then extend right to "二人", input "ふたり" and save. Saved by script ID.',
    frequentCandidates: '💡 Context candidates (click to apply):',
    addToGlossaryCheckbox: 'Add to Glossary (applies globally across all scripts)',
    customRubyInputLabel: 'Custom Reading (Hiragana / Katakana / Romaji):',
    customRubyInputPlaceholder: 'Type precise reading in this context...',
    clearRubyButton: 'Remove ruby for selection',
    saveAndNextButton: 'Save & Next',

    learnedModalTitle: '📚 Script Learned Context Readings',
    learnedModalDesc: 'Confirmed readings in review will memorize clause contexts and apply to matching sentences in this script automatically.',
    noLearnedRecords: 'No learned context records for this script.',
    contextPrefix: 'Context: ',

    glossaryModalTitle: 'Proper Noun Glossary',
    glossaryModalDesc: 'Names, places, and series terminology shared across all scripts. Literal longest match first; Word original and manual single edits take priority.',
    importGlossaryButton: 'Import Glossary',
    exportGlossaryButton: 'Export Glossary',
    editEntryLegend: 'Edit Entry',
    addEntryLegend: 'Add Entry',
    sourceTextLabel: 'Original Text',
    sourceTextPlaceholder: 'e.g. 小日向',
    readingLabel: 'Reading',
    readingPlaceholder: 'e.g. こひなた',
    readingFormatLabel: 'Format',
    romajiFormatOption: 'Romaji (retained verbatim in other modes)',
    saveEntryButton: 'Save Entry',
    cancelEditButton: 'Cancel Edit',
    searchEntryLabel: 'Search Entries',
    searchEntryPlaceholder: 'Search by text or reading',
    entryCountSummary: '{total} entries total, {visible} matching.',
    editButton: 'Edit',
    deleteButton: 'Delete',
    glossaryUpdatedNotice: 'Glossary updated and applied globally.',
    glossaryImportInvalid: 'Please import a valid Glossary JSON generated by this tool.',
    glossaryImportSuccess: 'Imported {count} entries; preserved existing readings on collision.',
    glossaryImportFailed: 'Import failed: ',
    glossaryExportSuccess: 'Glossary exported.',
    glossaryExportCancelled: 'Export cancelled.',
    glossaryExportFailed: 'Export failed: ',
  },
};
