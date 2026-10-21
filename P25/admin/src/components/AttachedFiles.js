import React from 'react';
import { DropdownMenu, DropdownItem, DropdownToggle, Card, UncontrolledDropdown } from "reactstrap";
import { Link } from "react-router-dom";

//i18n
import { useTranslation } from 'react-i18next';

const handleDelete = (file) => {
  console.log("🗑️ delete:", file.name);
};

const handleDownload = (file) => {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();

    URL.revokeObjectURL(url);
};

function AttachedFiles(props) {
    const files = props.files;
    console.log("here is the file info")
    console.log(files)

    /* intilize t variable for multi language implementation */
    const { t } = useTranslation();

    return (
        <React.Fragment>
            {
                files.map((file, key) =>
                    <Card key={key} className="p-2 border mb-2">
                        <div className="d-flex align-items-center">
                            <div
                                className="avatar-sm me-3 ms-0 d-flex align-items-center justify-content-center"
                                style={{ width: '40px', height: '40px', backgroundColor: '#eee6ff', borderRadius: '6px', flexShrink: 0,  flexGrow: 0 }}
                            >
                                <i className="ri-file-3-line" style={{ fontSize: '20px', color: '#6f42c1' }}></i>
                            </div>

                            <div className="flex-grow-1 overflow-hidden">
                                <div className="text-left">
                                    <h5 className="font-size-14 mb-1">{file.name}</h5>
                                    <p className="text-muted font-size-13 mb-0">{file.size}</p>
                                </div>
                            </div>

                            <div className="ms-auto d-flex justify-content-end align-items-center gap-2">
                                <button
                                    className="text-muted px-1 border-0 bg-transparent"
                                    onClick={() => handleDownload(file)}
                                >
                                    <i className="ri-download-2-line"></i>
                                </button>


                            </div>
                        </div>
                    </Card>
                )
            }
        </React.Fragment>
    );
}

export default AttachedFiles;