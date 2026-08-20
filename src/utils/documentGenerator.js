import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
/**
 * Downloads the Tailored Resume as a clean, professionally formatted PDF.
 */
export function downloadResumeAsPdf(resume, filename = 'Tailored_Resume.pdf') {
    const doc = new jsPDF({
        unit: 'pt',
        format: 'letter',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    const checkPageBreak = (neededHeight) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };
    // Header: Candidate Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 24, 33);
    doc.text(resume.candidateName || 'Candidate Name', margin, y);
    y += 18;
    // Contact Info Line
    const contactParts = [];
    if (resume.contactInfo?.email)
        contactParts.push(resume.contactInfo.email);
    if (resume.contactInfo?.phone)
        contactParts.push(resume.contactInfo.phone);
    if (resume.contactInfo?.location)
        contactParts.push(resume.contactInfo.location);
    if (resume.contactInfo?.linkedin)
        contactParts.push(resume.contactInfo.linkedin);
    if (resume.contactInfo?.portfolio)
        contactParts.push(resume.contactInfo.portfolio);
    if (contactParts.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(90, 99, 114);
        const contactLine = contactParts.join(' | ');
        const splitContact = doc.splitTextToSize(contactLine, contentWidth);
        doc.text(splitContact, margin, y);
        y += splitContact.length * 12 + 8;
    }
    else {
        y += 8;
    }
    // Divider
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
    const addSectionHeading = (title) => {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(title.toUpperCase(), margin, y);
        y += 4;
        doc.setDrawColor(180, 185, 195);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 12;
    };
    // 1. Professional Summary
    if (resume.professionalSummary) {
        addSectionHeading('Professional Summary');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(35, 40, 50);
        const summaryLines = doc.splitTextToSize(resume.professionalSummary, contentWidth);
        checkPageBreak(summaryLines.length * 13 + 6);
        doc.text(summaryLines, margin, y);
        y += summaryLines.length * 13 + 12;
    }
    // 2. Skills
    if (resume.skillsGroups && resume.skillsGroups.length > 0) {
        addSectionHeading('Technical Skills & Competencies');
        doc.setFontSize(9.5);
        for (const group of resume.skillsGroups) {
            checkPageBreak(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            const catText = `${group.category}: `;
            const catWidth = doc.getTextWidth(catText);
            doc.text(catText, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50, 55, 65);
            const skillsStr = group.skills.join(', ');
            const skillsLines = doc.splitTextToSize(skillsStr, contentWidth - catWidth);
            doc.text(skillsLines, margin + catWidth, y);
            y += skillsLines.length * 12 + 4;
        }
        y += 8;
    }
    // 3. Work Experience
    if (resume.workExperience && resume.workExperience.length > 0) {
        addSectionHeading('Professional Experience');
        for (const exp of resume.workExperience) {
            checkPageBreak(35);
            // Role & Duration
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(20, 25, 35);
            doc.text(exp.role || 'Role', margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(100, 110, 125);
            const durText = exp.duration || '';
            const durWidth = doc.getTextWidth(durText);
            doc.text(durText, pageWidth - margin - durWidth, y);
            y += 13;
            // Company & Location
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(55, 65, 81);
            let compText = exp.company || '';
            if (exp.location)
                compText += ` — ${exp.location}`;
            doc.text(compText, margin, y);
            y += 12;
            // Bullets
            if (exp.bullets && exp.bullets.length > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 50, 60);
                for (const bullet of exp.bullets) {
                    const bulletLines = doc.splitTextToSize(bullet, contentWidth - 14);
                    checkPageBreak(bulletLines.length * 12.5 + 4);
                    doc.text('•', margin + 2, y);
                    doc.text(bulletLines, margin + 14, y);
                    y += bulletLines.length * 12.5 + 3;
                }
            }
            y += 6;
        }
        y += 6;
    }
    // 4. Projects (if any)
    if (resume.projects && resume.projects.length > 0) {
        addSectionHeading('Key Projects');
        for (const proj of resume.projects) {
            checkPageBreak(25);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(20, 25, 35);
            let projTitle = proj.name;
            if (proj.technologies && proj.technologies.length > 0) {
                projTitle += ` (${proj.technologies.join(', ')})`;
            }
            doc.text(projTitle, margin, y);
            y += 12;
            if (proj.description) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 50, 60);
                const descLines = doc.splitTextToSize(proj.description, contentWidth);
                checkPageBreak(descLines.length * 12 + 3);
                doc.text(descLines, margin, y);
                y += descLines.length * 12 + 4;
            }
            if (proj.bullets && proj.bullets.length > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(45, 50, 60);
                for (const b of proj.bullets) {
                    const bLines = doc.splitTextToSize(b, contentWidth - 14);
                    checkPageBreak(bLines.length * 12 + 3);
                    doc.text('•', margin + 2, y);
                    doc.text(bLines, margin + 14, y);
                    y += bLines.length * 12 + 3;
                }
            }
            y += 4;
        }
        y += 6;
    }
    // 5. Education
    if (resume.education && resume.education.length > 0) {
        addSectionHeading('Education');
        for (const edu of resume.education) {
            checkPageBreak(20);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(20, 25, 35);
            doc.text(edu.degree || 'Degree', margin, y);
            if (edu.year) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(100, 110, 125);
                const yrWidth = doc.getTextWidth(edu.year);
                doc.text(edu.year, pageWidth - margin - yrWidth, y);
            }
            y += 12;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(55, 65, 81);
            let instText = edu.institution || '';
            if (edu.details)
                instText += ` — ${edu.details}`;
            doc.text(instText, margin, y);
            y += 14;
        }
        y += 4;
    }
    // 6. Certifications
    if (resume.certifications && resume.certifications.length > 0) {
        addSectionHeading('Certifications');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(45, 50, 60);
        for (const cert of resume.certifications) {
            checkPageBreak(14);
            doc.text(`• ${cert}`, margin + 2, y);
            y += 13;
        }
    }
    doc.save(filename);
}
/**
 * Downloads the Tailored Resume as a clean, professionally formatted DOCX file.
 */
export async function downloadResumeAsDocx(resume, filename = 'Tailored_Resume.docx') {
    const children = [];
    // Name
    children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        children: [
            new TextRun({
                text: resume.candidateName || 'Candidate Name',
                bold: true,
                size: 32, // 16pt
                font: 'Arial',
                color: '141821',
            }),
        ],
    }));
    // Contact Info
    const contactParts = [];
    if (resume.contactInfo?.email)
        contactParts.push(resume.contactInfo.email);
    if (resume.contactInfo?.phone)
        contactParts.push(resume.contactInfo.phone);
    if (resume.contactInfo?.location)
        contactParts.push(resume.contactInfo.location);
    if (resume.contactInfo?.linkedin)
        contactParts.push(resume.contactInfo.linkedin);
    if (resume.contactInfo?.portfolio)
        contactParts.push(resume.contactInfo.portfolio);
    if (contactParts.length > 0) {
        children.push(new Paragraph({
            spacing: { after: 180 },
            border: {
                bottom: {
                    color: 'C8CDD7',
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 6,
                },
            },
            children: [
                new TextRun({
                    text: contactParts.join('  |  '),
                    size: 19, // 9.5pt
                    font: 'Arial',
                    color: '5A6372',
                }),
            ],
        }));
    }
    const createSectionHeading = (title) => {
        return new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
            border: {
                bottom: {
                    color: 'B4B9C3',
                    space: 2,
                    style: BorderStyle.SINGLE,
                    size: 4,
                },
            },
            children: [
                new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 22, // 11pt
                    font: 'Arial',
                    color: '1E293B',
                }),
            ],
        });
    };
    // 1. Summary
    if (resume.professionalSummary) {
        children.push(createSectionHeading('Professional Summary'));
        children.push(new Paragraph({
            spacing: { after: 140 },
            children: [
                new TextRun({
                    text: resume.professionalSummary,
                    size: 20, // 10pt
                    font: 'Arial',
                    color: '232832',
                }),
            ],
        }));
    }
    // 2. Skills
    if (resume.skillsGroups && resume.skillsGroups.length > 0) {
        children.push(createSectionHeading('Technical Skills & Competencies'));
        for (const group of resume.skillsGroups) {
            children.push(new Paragraph({
                spacing: { after: 60 },
                children: [
                    new TextRun({
                        text: `${group.category}: `,
                        bold: true,
                        size: 19,
                        font: 'Arial',
                        color: '1E293B',
                    }),
                    new TextRun({
                        text: group.skills.join(', '),
                        size: 19,
                        font: 'Arial',
                        color: '323741',
                    }),
                ],
            }));
        }
    }
    // 3. Work Experience
    if (resume.workExperience && resume.workExperience.length > 0) {
        children.push(createSectionHeading('Professional Experience'));
        for (const exp of resume.workExperience) {
            // Role & Duration
            children.push(new Paragraph({
                spacing: { before: 120, after: 30 },
                children: [
                    new TextRun({
                        text: exp.role || 'Role',
                        bold: true,
                        size: 21,
                        font: 'Arial',
                        color: '141923',
                    }),
                    new TextRun({
                        text: `\t${exp.duration || ''}`,
                        size: 19,
                        font: 'Arial',
                        color: '646E7D',
                    }),
                ],
            }));
            // Company
            let compText = exp.company || '';
            if (exp.location)
                compText += ` — ${exp.location}`;
            children.push(new Paragraph({
                spacing: { after: 80 },
                children: [
                    new TextRun({
                        text: compText,
                        bold: true,
                        size: 19,
                        font: 'Arial',
                        color: '374151',
                    }),
                ],
            }));
            // Bullets
            if (exp.bullets && exp.bullets.length > 0) {
                for (const bullet of exp.bullets) {
                    children.push(new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 40 },
                        children: [
                            new TextRun({
                                text: bullet,
                                size: 19,
                                font: 'Arial',
                                color: '2D323C',
                            }),
                        ],
                    }));
                }
            }
        }
    }
    // 4. Projects
    if (resume.projects && resume.projects.length > 0) {
        children.push(createSectionHeading('Key Projects'));
        for (const proj of resume.projects) {
            let projTitle = proj.name;
            if (proj.technologies && proj.technologies.length > 0) {
                projTitle += ` (${proj.technologies.join(', ')})`;
            }
            children.push(new Paragraph({
                spacing: { before: 80, after: 30 },
                children: [
                    new TextRun({
                        text: projTitle,
                        bold: true,
                        size: 20,
                        font: 'Arial',
                        color: '141923',
                    }),
                ],
            }));
            if (proj.description) {
                children.push(new Paragraph({
                    spacing: { after: 50 },
                    children: [
                        new TextRun({
                            text: proj.description,
                            size: 19,
                            font: 'Arial',
                            color: '2D323C',
                        }),
                    ],
                }));
            }
            if (proj.bullets && proj.bullets.length > 0) {
                for (const b of proj.bullets) {
                    children.push(new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 40 },
                        children: [
                            new TextRun({
                                text: b,
                                size: 19,
                                font: 'Arial',
                                color: '2D323C',
                            }),
                        ],
                    }));
                }
            }
        }
    }
    // 5. Education
    if (resume.education && resume.education.length > 0) {
        children.push(createSectionHeading('Education'));
        for (const edu of resume.education) {
            children.push(new Paragraph({
                spacing: { before: 80, after: 30 },
                children: [
                    new TextRun({
                        text: edu.degree || 'Degree',
                        bold: true,
                        size: 20,
                        font: 'Arial',
                        color: '141923',
                    }),
                    new TextRun({
                        text: edu.year ? `\t${edu.year}` : '',
                        size: 19,
                        font: 'Arial',
                        color: '646E7D',
                    }),
                ],
            }));
            let instText = edu.institution || '';
            if (edu.details)
                instText += ` — ${edu.details}`;
            children.push(new Paragraph({
                spacing: { after: 80 },
                children: [
                    new TextRun({
                        text: instText,
                        size: 19,
                        font: 'Arial',
                        color: '374151',
                    }),
                ],
            }));
        }
    }
    // 6. Certifications
    if (resume.certifications && resume.certifications.length > 0) {
        children.push(createSectionHeading('Certifications'));
        for (const cert of resume.certifications) {
            children.push(new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 40 },
                children: [
                    new TextRun({
                        text: cert,
                        size: 19,
                        font: 'Arial',
                        color: '2D323C',
                    }),
                ],
            }));
        }
    }
    const doc = new Document({
        sections: [
            {
                properties: {},
                children,
            },
        ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
}
/**
 * Downloads the Cover Letter as a clean, professionally formatted PDF.
 */
export function downloadCoverLetterPdf(coverLetterText, candidateName = 'Candidate', targetRole = 'Role', targetCompany = 'Company', filename = 'Cover_Letter.pdf') {
    const doc = new jsPDF({
        unit: 'pt',
        format: 'letter',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    // Header Candidate Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20, 24, 33);
    doc.text(candidateName, margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 110, 125);
    doc.text(`Application for ${targetRole} at ${targetCompany}`, margin, y);
    y += 14;
    // Divider
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;
    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 55, 65);
    const today = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    doc.text(today, margin, y);
    y += 20;
    // Paragraphs
    const paragraphs = coverLetterText.split('\n\n');
    doc.setFontSize(10.5);
    doc.setTextColor(35, 40, 50);
    for (const para of paragraphs) {
        if (!para.trim())
            continue;
        const splitPara = doc.splitTextToSize(para.trim(), contentWidth);
        if (y + splitPara.length * 14 > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.text(splitPara, margin, y);
        y += splitPara.length * 14 + 14;
    }
    doc.save(filename);
}
