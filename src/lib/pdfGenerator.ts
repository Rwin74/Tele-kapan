import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export const generatePDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId)
  if (!element) return

  // Make sure it's fully rendered before snapshotting
  element.style.display = 'block'

  const canvas = await html2canvas(element, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4'
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  pdf.save(`${filename}.pdf`)

  element.style.display = 'none'
}
