import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Search, X, FolderOpen, FileText, Link, Youtube, Copy, ChevronLeft, BookOpen, Upload } from "lucide-react"
import { useState } from "react"

export default function UploadDialog({ showAddModal, setShowAddModal }: { showAddModal: boolean, setShowAddModal: (showAddModal: boolean) => void }) {
  const [showWebsiteModal, setShowWebsiteModal] = useState(false)
  const [showPasteTextModal, setShowPasteTextModal] = useState(false)
  const [websiteUrls, setWebsiteUrls] = useState("")
  const [pasteText, setPasteText] = useState("")

  return (
    <>
      {/* Add Sources Modal */}
      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-5xl bg-gray-900 border-gray-700 text-white">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Add sources</DialogTitle>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Explanatory Text */}
              <div className="text-center">
                <p className="text-gray-300 mb-2">
                  Sources let the model base its responses on the information that matters most to you.
                </p>
                <p className="text-sm text-gray-400">
                  (marketing plans, course reading, research notes, meeting transcripts, sales documents, etc.)
                </p>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-gray-500 transition-colors">
                <div className="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-medium mb-2">Upload sources</h3>
                <p className="text-gray-400 mb-4">
                  Drag and drop or{" "}
                  <button className="text-blue-400 hover:text-blue-300 underline">choose file to upload</button>
                </p>
                <p className="text-sm text-gray-500">PDF, .txt, Markdown, Audio (e.g. mp3)</p>
              </div>

              {/* Source Options */}
              <div className="grid grid-cols-3 gap-4">
                {/* Google Drive Card */}
                <div className="border border-dashed border-gray-600 rounded-lg p-4">
                  <span className="text-sm font-medium text-gray-300 mb-3 block">Microsoft OneDrive</span>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                    >
                      <FolderOpen className="w-4 h-4 mr-2 text-blue-400" />
                      OneDrive
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                    >
                      <FileText className="w-4 h-4 mr-2 text-blue-400" />
                      Confluence
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                    >
                      <FileText className="w-4 h-4 mr-2 text-orange-400" />
                      Jira
                    </Button>
                  </div>
                </div>

                {/* Link Card */}
                <div className="border border-dashed border-gray-600 rounded-lg p-4">
                  <span className="text-sm font-medium text-gray-300 mb-3 block">Link</span>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                      onClick={() => setShowWebsiteModal(true)}
                    >
                      <Link className="w-4 h-4 mr-2 text-green-400" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                      onClick={() => setShowWebsiteModal(true)}
                    >
                      <FileText className="w-4 h-4 mr-2 text-gray-400" />
                      Website
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                    >
                      <Youtube className="w-4 h-4 mr-2 text-red-400" />
                      YouTube
                    </Button>
                  </div>
                </div>

                {/* Paste Text Card */}
                <div className="border border-dashed border-gray-600 rounded-lg p-4">
                  <span className="text-sm font-medium text-gray-300 mb-3 block">Paste text</span>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                      onClick={() => setShowPasteTextModal(true)}
                    >
                      <FileText className="w-4 h-4 mr-2 text-purple-400" />
                      Paste text
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-gray-800 border-gray-600 text-white hover:bg-gray-700 justify-start"
                      onClick={() => setShowPasteTextModal(true)}
                    >
                      <Copy className="w-4 h-4 mr-2 text-gray-400" />
                      Copied text
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">0/100</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Website URLs Modal */}
      {showWebsiteModal && (
        <Dialog open={showWebsiteModal} onOpenChange={setShowWebsiteModal}>
          <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowWebsiteModal(false)
                    setShowAddModal(true)
                  }}
                  className="text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-400">Notebook</div>
                  <DialogTitle className="text-xl font-semibold">Website URLs</DialogTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWebsiteModal(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>

            <div className="space-y-6">
              <p className="text-gray-300">Paste in web URLs below to upload as sources in Notebook.</p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Paste URLs*</label>
                <textarea
                  value={websiteUrls}
                  onChange={(e) => setWebsiteUrls(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-32 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {!websiteUrls.trim() && <p className="text-sm text-red-400">Please fill out this field.</p>}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Notes</h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• To add multiple URLs, separate with a space or new line.</li>
                  <li>• Only the visible text on the website will be imported.</li>
                  <li>• Paid articles are not supported.</li>
                </ul>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-700">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!websiteUrls.trim()}>
                  Insert
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Paste Text Modal */}
      {showPasteTextModal && (
        <Dialog open={showPasteTextModal} onOpenChange={setShowPasteTextModal}>
          <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPasteTextModal(false)
                    setShowAddModal(true)
                  }}
                  className="text-gray-400 hover:text-white hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-400">Notebook</div>
                  <DialogTitle className="text-xl font-semibold">Paste copied text</DialogTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPasteTextModal(false)}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>

            <div className="space-y-6">
              <p className="text-gray-300">Paste your copied text below to upload as a source in NotebookLM</p>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Paste text here*</label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your text content here..."
                  className="w-full h-48 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {!pasteText.trim() && <p className="text-sm text-red-400">Please fill out this field.</p>}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-700">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!pasteText.trim()}>
                  Insert
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}